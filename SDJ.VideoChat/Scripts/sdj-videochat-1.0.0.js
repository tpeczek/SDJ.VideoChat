/*
 * Software Developer`s Journal UserMedia and WebRTC Demo v1.0.0
 *
 * Copyright © 2015 Tomasz Pęczek
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Depends on:
 * - webrtc-samples-adapter.js (https://github.com/webrtc/samples/blob/master/src/js/adapter.js)
 */

var sdj = sdj || {};

sdj.application = (function () {
    var CHAT_STATE_DISCONNECTED = 'DISCONNECTED';
    var CHAT_STATE_CONNECTING = 'CONNECTING';
    var CHAT_STATE_CONNECTED = 'CONNECTED';

    var chatContext = { };

    var initializeChatHub = function() {
        chatContext.userName = prompt('Enter your name:', '');
        chatContext.state = CHAT_STATE_DISCONNECTED;

        chatContext.hub = $.connection.videoChatHub;
        chatContext.hub.client.updateUsersList = renderChatUsersList;
        chatContext.hub.client.incomingRequest = respondToChatConnectionRequest;
        chatContext.hub.client.requestDeclined = chatConnectionRequestDeclined;
        chatContext.hub.client.requestApproved = chatConnectionRequestApproved;
        chatContext.hub.client.connectionDisconnected = chatConnectionDisconnected;
        chatContext.hub.client.webRTCMessage = receivedWebRTCMessage;

        $.connection.hub.start()
        .done(function() {
            chatContext.connectionId = chatContext.hub.connection.id;
            chatContext.hub.server.join(chatContext.userName);
        })
        .fail(function(error) {
            alert('Unable to establish ASP.NET SignalR connection, following error occured: ' + error);
        });
    };

    var initializeEvents = function() {
        $(chatContext.usersListWidgetContent).on('click', 'a', function (evt) {
            evt.preventDefault();
            evt.stopPropagation();

            var partnerConnectionId = $(this).attr('data-connection');

            if (chatContext.connectionId !== partnerConnectionId) {
                if ((chatContext.state == CHAT_STATE_DISCONNECTED) || confirm('You are already in a chat. Please confirm that you want to disconnect.')) {
                    disconnectChatConnection();
                    requestChatConnection(partnerConnectionId);
                }
            } else {
                alert('You are attempting to chat yourself.');
            }
        });

        $('div.ui-actions button:first').click(function () {
            disconnectChatConnection();
        });
    };

    var renderChatUsersList = function(users) {
        chatContext.usersListWidgetContent.empty();

        for (var i = 0; i < users.length; i++) {
            var $userIcon = $('<span />').addClass('ui-icon ui-icon-person');
            var $userText = $('<span />').addClass('ui-text').text(users[i].UserName);
            var $userAnchor = $('<a />').attr({ 'href': '#', 'data-connection': users[i].ConnectionId }).append($userIcon).append($userText);
            var $userItem = $('<li />').append($userAnchor);

            chatContext.usersListWidgetContent.append($userItem);
        }
    };

    var requestChatConnection = function(partnerConnectionId) {
        chatContext.state = CHAT_STATE_CONNECTING;
        chatContext.hub.server.requestConnection(partnerConnectionId);
    };

    var respondToChatConnectionRequest = function(user) {
        if (confirm('The user "' + user.UserName + '" would like to chat with you.'))
        {
            chatContext.hub.server.answerRequest(user.ConnectionId, true);
            chatContext.partnerConnectionId = user.ConnectionId;
            chatContext.state = CHAT_STATE_CONNECTED;
        }
        else
        {
            chatContext.hub.server.AnswerRequest(user.ConnectionId, false);
        }
    };

    var chatConnectionRequestDeclined = function(reason) {
        alert(reason);
        chatContext.state = CHAT_STATE_DISCONNECTED;
    };

    var chatConnectionRequestApproved = function(partnerConnectionId) {
        createWebRTCOffer(partnerConnectionId);
        chatContext.partnerConnectionId = partnerConnectionId;
        chatContext.state = CHAT_STATE_CONNECTED;
    };

    var chatConnectionDisconnected = function() {
        alert("The chat connection has been ended.")
        closeWebRTCConnection();
        chatContext.partnerConnectionId = null;
        chatContext.state = CHAT_STATE_DISCONNECTED;
    };

    var disconnectChatConnection = function() {
        if (chatContext.state !== CHAT_STATE_DISCONNECTED) {
            chatContext.hub.server.disconnectConnection();
            closeWebRTCConnection();
            chatContext.partnerConnectionId = null;
            chatContext.state = CHAT_STATE_DISCONNECTED;
        }
    };

    var createWebRTCConnection = function(partnerConnectionId) {
        chatContext.webRTCConnection = new RTCPeerConnection();

        chatContext.webRTCConnection.onicecandidate = function(evt) {
            if (evt.candidate) {
                chatContext.hub.server.relyWebRTCMessage(JSON.stringify({ candidate: evt.candidate }), partnerConnectionId);
            }
        };

        chatContext.webRTCConnection.onaddstream = function(evt) {
            attachMediaStream(chatContext.partnerViewer, evt.stream);
        };

        chatContext.webRTCConnection.onremovestream = function(evt) {
            chatContext.partnerViewer.src = '';
        };
    };

    var createWebRTCOffer = function (partnerConnectionId) {
        createWebRTCConnection(partnerConnectionId);

        chatContext.webRTCConnection.addStream(chatContext.mediaStream);

        chatContext.webRTCConnection.createOffer(function(offer) {
            chatContext.webRTCConnection.setLocalDescription(new RTCSessionDescription(offer), function () {
                chatContext.hub.server.relyWebRTCMessage(JSON.stringify({ sdp: offer }), partnerConnectionId);
            }, function (error) { console.log(error); });
        }, function (error) { console.log(error); });
    };

    var closeWebRTCConnection = function() {
        if (chatContext.webRTCConnection) {
            chatContext.partnerViewer.src = '';

            chatContext.webRTCConnection.close();
            chatContext.webRTCConnection = null;
        }
    };

    var receivedWebRTCMessage = function(partnerConnectionId, message) {
        var webRTCMessage = JSON.parse(message);

        if (!chatContext.webRTCConnection) {
            createWebRTCConnection(partnerConnectionId);
        }

        if (webRTCMessage.sdp) {
            chatContext.webRTCConnection.setRemoteDescription(new RTCSessionDescription(webRTCMessage.sdp), function() {
                if (chatContext.webRTCConnection.remoteDescription.type == 'offer') {
                    chatContext.webRTCConnection.addStream(chatContext.mediaStream);
                    chatContext.webRTCConnection.createAnswer(function(answer) {
                        chatContext.webRTCConnection.setLocalDescription(new RTCSessionDescription(answer), function () {
                            chatContext.hub.server.relyWebRTCMessage(JSON.stringify({ sdp: answer }), partnerConnectionId);
                        }, function(error) { console.log(error); });
                    }, function(error) { console.log(error); });
                }
            }, function(error) { console.log(error); });
        } else if (webRTCMessage.candidate) {
            chatContext.webRTCConnection.addIceCandidate(new RTCIceCandidate(webRTCMessage.candidate));
        }
    };

    return {
        initializeEcho: function(echoViewerId) {
            if (getUserMedia) {
                getUserMedia(
                    // Required permissions
                    { video: true, audio: true },
                    // Success callback
                    function(mediaStream) {
                        var videoElement = document.getElementById(echoViewerId);
                        attachMediaStream(videoElement, mediaStream);
                    },
                    // Error callback
                    function(error) {
                        alert('The following error occured: ' + error);
                    }
                );
            } else {
                alert('Your browser doesn\'t support media devices.');
            }
        },
        initializeChat: function (usersListWidgetContent, ownViewer, partnerViewer) {
            chatContext.usersListWidgetContent = usersListWidgetContent;
            chatContext.ownViewer = ownViewer;
            chatContext.partnerViewer = partnerViewer;

            if (getUserMedia) {
                getUserMedia(
                    { video: true, audio: true },
                    function (mediaStream) {
                        chatContext.mediaStream = mediaStream;

                        initializeChatHub();
                        initializeEvents();

                        attachMediaStream(chatContext.ownViewer, chatContext.mediaStream);
                    },
                    function(error) {
                        alert('The following error occured: ' + error);
                    }
                );
            } else {
                alert('Your browser doesn\'t support media devices.');
            }
        }
    };
})();