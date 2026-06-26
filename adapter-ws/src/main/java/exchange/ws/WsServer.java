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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 웹소켓 게이트웨이 메인 서버 클래스.
 * Netty 기반의 비동기 웹소켓 서버를 초기화하고 구동하며, 카프카 브로드캐스터 및 메트릭 서버를 함께 실행한다.
 */
public final class WsServer {
    private static final Logger log = LoggerFactory.getLogger(WsServer.class);

    public static void main(String[] args) throws Exception {
        WsMetricsServer.getInstance().start();
        MarketConfigManager.getInstance().start();
        String broker = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
        int port = ConfigLoader.getInt("PORT", 8088);


        log.info("Starting Netty WebSocket Gateway on port: {}", port);
        log.info("Consuming from Kafka Broker: {}", broker);

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
            MarketConfigManager.getInstance().stop();
            broadcaster.stop();
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}
