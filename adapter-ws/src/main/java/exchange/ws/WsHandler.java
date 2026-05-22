package exchange.ws;

import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.group.ChannelGroup;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.handler.codec.http.websocketx.TextWebSocketFrame;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.Socket;
import java.io.PrintWriter;

public final class WsHandler extends SimpleChannelInboundHandler<Object> {
    private final ChannelGroup clients;
    private final String engineHost;
    private final int enginePort;
    
    private Socket engineSocket;
    private PrintWriter engineWriter;

    public WsHandler(ChannelGroup clients) {
        this.clients = clients;
        this.engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        this.enginePort = ConfigLoader.getInt("ENGINE_PORT", 9999);

    }

    @Override
    public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
        // Connection initiated
    }

    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client disconnected: " + ctx.channel().remoteAddress());
        clients.remove(ctx.channel());
        closeEngineSocket();
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
        if (msg instanceof TextWebSocketFrame) {
            String text = ((TextWebSocketFrame) msg).text();
            try {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode node = mapper.readTree(text);
                
                String action = node.has("action") ? node.get("action").asText() : "";
                
                if ("NEW".equalsIgnoreCase(action)) {
                    String side = node.has("side") ? node.get("side").asText() : "";
                    long price = node.has("price") ? node.get("price").asLong() : 0;
                    long qty = node.has("qty") ? node.get("qty").asLong() : 0;
                    
                    if (!side.isEmpty() && price > 0 && qty > 0) {
                        String cmd = String.format("NEW,%s,%d,%d", side.toUpperCase(), price, qty);
                        sendToEngine(cmd);
                    }
                } else if ("CANCEL".equalsIgnoreCase(action)) {
                    long orderId = node.has("orderId") ? node.get("orderId").asLong() : 0;
                    if (orderId > 0) {
                        String cmd = String.format("CANCEL,%d", orderId);
                        sendToEngine(cmd);
                    }
                }
            } catch (Exception e) {
                System.err.println("Failed to process incoming WS frame: " + text + ", error: " + e.getMessage());
            }
        }
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        System.err.println("WS client exception: " + cause.getMessage());
        ctx.close();
    }

    private synchronized void sendToEngine(String cmd) {
        try {
            if (engineSocket == null || engineSocket.isClosed() || !engineSocket.isConnected()) {
                System.out.println("Connecting to Matching Engine command port at " + engineHost + ":" + enginePort);
                engineSocket = new Socket(engineHost, enginePort);
                engineWriter = new PrintWriter(engineSocket.getOutputStream(), true);
            }
            engineWriter.println(cmd);
            engineWriter.flush();
        } catch (Exception e) {
            System.err.println("Error sending command to Matching Engine: " + e.getMessage());
            closeEngineSocket();
        }
    }
    
    private void closeEngineSocket() {
        try {
            if (engineWriter != null) {
                engineWriter.close();
            }
            if (engineSocket != null) {
                engineSocket.close();
            }
        } catch (Exception ignored) {}
        engineSocket = null;
        engineWriter = null;
    }
}

