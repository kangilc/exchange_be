package exchange.ws;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.group.ChannelGroup;
import io.netty.channel.group.DefaultChannelGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.websocketx.WebSocketServerProtocolHandler;
import io.netty.util.concurrent.GlobalEventExecutor;

public final class WsServer {
    public static void main(String[] args) throws Exception {
        String broker = System.getenv("KAFKA_BROKER");
        if (broker == null || broker.isEmpty()) {
            broker = "localhost:9092";
        }

        int port = 8080;
        String portStr = System.getenv("PORT");
        if (portStr != null && !portStr.isEmpty()) {
            port = Integer.parseInt(portStr);
        }

        System.out.println("Starting Netty WebSocket Gateway on port: " + port);
        System.out.println("Consuming from Kafka Broker: " + broker);

        // Broadcaster mapping active Netty client channels
        ChannelGroup clients = new DefaultChannelGroup(GlobalEventExecutor.INSTANCE);

        // Start asynchronous background Kafka consumer loop
        WsBroadcaster broadcaster = new WsBroadcaster(clients, broker);
        Thread broadcasterThread = new Thread(broadcaster, "ws-broadcaster");
        broadcasterThread.start();

        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();

        try {
            ServerBootstrap b = new ServerBootstrap();
            b.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childOption(ChannelOption.TCP_NODELAY, true)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ch.pipeline()
                                    .addLast(new HttpServerCodec())
                                    .addLast(new HttpObjectAggregator(65536))
                                    .addLast(new WebSocketServerProtocolHandler("/ws"))
                                    .addLast(new WsHandler(clients));
                        }
                    });

            b.bind(port).sync().channel().closeFuture().sync();
        } finally {
            broadcaster.stop();
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}
