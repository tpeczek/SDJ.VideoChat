using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.AspNet.SignalR;
using System.Threading.Tasks;

namespace SDJ.VideoChat.Hubs
{
    public class VideoChatHub : Hub
    {
        #region Fields
        private static readonly IDictionary<string, string> _connectedUsers = new Dictionary<string, string>();
        private static readonly IList<Tuple<string, string>> _chatConnections = new List<Tuple<string, string>>();
        #endregion

        #region Methods
        public void Join(string userName)
        {
            _connectedUsers.Add(Context.ConnectionId, userName);
            BroadcastUsersList();
        }

        public override Task OnDisconnected(bool stopCalled)
        {
            DisconnectConnection();
            _connectedUsers.Remove(Context.ConnectionId);
            BroadcastUsersList();

            return base.OnDisconnected(stopCalled);
        }

        private void BroadcastUsersList()
        {
            Clients.All.updateUsersList(_connectedUsers.Select(u => new {
                ConnectionId = u.Key,
                UserName = u.Value
            }));
        }

        public void RequestConnection(string partnerConnectionId)
        {
            if (_connectedUsers.ContainsKey(partnerConnectionId))
            {
                if (!_chatConnections.Any(c => (c.Item1 == partnerConnectionId) || (c.Item2 == partnerConnectionId)))
                {
                    Clients.Client(partnerConnectionId).incomingRequest(new { ConnectionId = Context.ConnectionId, UserName = _connectedUsers[Context.ConnectionId] });
                    _chatConnections.Add(new Tuple<string,string>(Context.ConnectionId, partnerConnectionId));
                }
                else
                {
                    Clients.Caller.requestDeclined("The user is currently busy.");
                }
            }
            else
            {
                Clients.Caller.requestDeclined("The user is no longer available.");
            }
        }

        public void AnswerRequest(string originConnectionId, bool approved)
        {
            if (_connectedUsers.ContainsKey(originConnectionId) && _chatConnections.Any(c => ((c.Item1 == originConnectionId) && (c.Item2 == Context.ConnectionId))))
            {
                if (approved)
                {
                    Clients.Client(originConnectionId).requestApproved(Context.ConnectionId);
                }
                else
                {
                    Clients.Client(originConnectionId).requestDeclined("The user didn't accept the request.");
                }
            }
            else
            {
                Clients.Caller.connectionDisconnected();
            }
        }

        public void DisconnectConnection()
        {
            Tuple<string, string> chatConnection = _chatConnections.FirstOrDefault(c => (c.Item1 == Context.ConnectionId) || (c.Item2 == Context.ConnectionId));
            if (chatConnection != null)
            {
                string partnerId = (chatConnection.Item1 == Context.ConnectionId) ? chatConnection.Item2 : chatConnection.Item1;
                Clients.Client(partnerId).connectionDisconnected();
                _chatConnections.Remove(chatConnection);
            }
        }

        public void RelyWebRTCMessage(string message, string partnerConnectionId)
        {
            Tuple<string, string> chatConnection = _chatConnections.FirstOrDefault(c => (c.Item1 == Context.ConnectionId) && (c.Item2 == partnerConnectionId));
            if (chatConnection != null)
            {
                Clients.Client(partnerConnectionId).webRTCMessage(Context.ConnectionId, message);
            }
        }
        #endregion
    }
}