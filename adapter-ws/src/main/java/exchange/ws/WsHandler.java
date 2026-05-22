package exchange.ws;

import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.group.ChannelGroup;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;

public final class WsHandler extends SimpleChannelInboundHandler<Object> {
    private final ChannelGroup clients;

    public WsHandler(ChannelGroup clients) {
        this.clients = clients;
    }

    @Override
    public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
        // Connection initiated
    }

    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client disconnected: " + ctx.channel().remoteAddress());
        clients.remove(ctx.channel());
    }

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            // WebSocket connection fully established, add to broadcaster list
            clients.add(ctx.channel());
            System.out.println("WebSocket connection established with: " + ctx.channel().remoteAddress());
        } else {
            super.userEventTriggered(ctx, evt);
        }
    }

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Exception {
        // Read-only server; discard incoming user messages for simplicity
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("WS client exception: " + cause.getMessage());
        ctx.close();
    }
}
