using Owin;
using Microsoft.Owin;

[assembly: OwinStartup(typeof(SDJ.VideoChat.Startup))]

namespace SDJ.VideoChat
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            app.MapSignalR();
        }
    }
}