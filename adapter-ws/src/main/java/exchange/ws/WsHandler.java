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
    private final String adaEngineHost;
    private final int btcPort;
    private final int adaPort;
    
    private Socket btcSocket;
    private PrintWriter btcWriter;
    private Socket adaSocket;
    private PrintWriter adaWriter;

    public WsHandler(ChannelGroup clients) {
        this.clients = clients;
        this.engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        this.adaEngineHost = ConfigLoader.get("ADA_ENGINE_HOST", "localhost");
        this.btcPort = ConfigLoader.getInt("COMMAND_PORT", 9999);
        this.adaPort = ConfigLoader.getInt("ADA_COMMAND_PORT", 9997);
    }

    @Override
    public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
        // Connection initiated
    }

    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
        System.out.println("Client disconnected: " + ctx.channel().remoteAddress());
        clients.remove(ctx.channel());
        WsMetricsServer.getInstance().decrementConnections();
        closeAllSockets();
    }

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            clients.add(ctx.channel());
            WsMetricsServer.getInstance().incrementConnections();
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
                String symbol = node.has("symbol") ? node.get("symbol").asText() : "BTC-USD";
                
                if ("PING".equalsIgnoreCase(action)) {
                    long timestamp = node.has("timestamp") ? node.get("timestamp").asLong() : 0;
                    String pong = String.format("{\"action\":\"PONG\",\"timestamp\":%d}", timestamp);
                    ctx.channel().writeAndFlush(new TextWebSocketFrame(pong));
                    WsMetricsServer.getInstance().incrementMessages();
                    return;
                }
                
                if ("NEW".equalsIgnoreCase(action)) {
                    String side = node.has("side") ? node.get("side").asText() : "";
                    long price = node.has("price") ? node.get("price").asLong() : 0;
                    long qty = node.has("qty") ? node.get("qty").asLong() : 0;
                    long userId = node.has("userId") ? node.get("userId").asLong() : 1;
                    
                    if (!side.isEmpty() && price > 0 && qty > 0) {
                        java.math.BigDecimal minAmt = MarketConfigManager.getInstance().getMinAmt(symbol);
                        if (minAmt.compareTo(java.math.BigDecimal.ZERO) > 0) {
                            java.math.BigDecimal totalAmt = java.math.BigDecimal.valueOf(price)
                                    .multiply(java.math.BigDecimal.valueOf(qty))
                                    .divide(java.math.BigDecimal.valueOf(100));
                            if (totalAmt.compareTo(minAmt) < 0) {
                                String rejectMsg = String.format(
                                        "{\"action\":\"REJECT\",\"symbol\":\"%s\",\"side\":\"%s\",\"price\":%d,\"qty\":%d,\"reason\":\"Minimum order amount requirement not met.\"}",
                                        symbol, side.toUpperCase(), price, qty
                                );
                                ctx.channel().writeAndFlush(new TextWebSocketFrame(rejectMsg));
                                return;
                            }
                        }

                        String cmd = String.format("NEW,%s,%d,%d,%d", side.toUpperCase(), price, qty, userId);
                        sendToEngine(symbol, cmd);
                        WsMetricsServer.getInstance().incrementMessages();
                    }
                } else if ("CANCEL".equalsIgnoreCase(action)) {
                    long orderId = node.has("orderId") ? node.get("orderId").asLong() : 0;
                    if (orderId > 0) {
                        String cmd = String.format("CANCEL,%d", orderId);
                        sendToEngine(symbol, cmd);
                        WsMetricsServer.getInstance().incrementMessages();
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

    private synchronized void sendToEngine(String symbol, String cmd) {
        boolean isAda = "ADA-KRW".equalsIgnoreCase(symbol);
        String targetHost = isAda ? adaEngineHost : engineHost;
        int targetPort = isAda ? adaPort : btcPort;
        Socket targetSocket = isAda ? adaSocket : btcSocket;
        PrintWriter targetWriter = isAda ? adaWriter : btcWriter;

        try {
            if (targetSocket == null || targetSocket.isClosed() || !targetSocket.isConnected()) {
                System.out.println("Connecting to Matching Engine command port (" + symbol + ") at " + targetHost + ":" + targetPort);
                targetSocket = new Socket(targetHost, targetPort);
                targetWriter = new PrintWriter(targetSocket.getOutputStream(), true);
                
                if (isAda) {
                    adaSocket = targetSocket;
                    adaWriter = targetWriter;
                } else {
                    btcSocket = targetSocket;
                    btcWriter = targetWriter;
                }
            }
            targetWriter.println(cmd);
            targetWriter.flush();
        } catch (Exception e) {
            System.err.println("Error sending command to Matching Engine (" + symbol + "): " + e.getMessage());
            closeSocket(isAda);
        }
    }
    
    private void closeSocket(boolean isAda) {
        try {
            if (isAda) {
                if (adaWriter != null) adaWriter.close();
                if (adaSocket != null) adaSocket.close();
                adaSocket = null;
                adaWriter = null;
            } else {
                if (btcWriter != null) btcWriter.close();
                if (btcSocket != null) btcSocket.close();
                btcSocket = null;
                btcWriter = null;
            }
        } catch (Exception ignored) {}
    }

    private void closeAllSockets() {
        closeSocket(true);
        closeSocket(false);
    }
}
