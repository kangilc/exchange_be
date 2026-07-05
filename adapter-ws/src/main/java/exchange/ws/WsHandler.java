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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 웹소켓 클라이언트 메시지 핸들러.
 *
 * <p>Netty의 {@link SimpleChannelInboundHandler}를 상속하여 다음 역할을 수행함.</p>
 * <ul>
 *   <li>클라이언트 연결 수명주기(연결/해제) 관리 및 ChannelGroup 갱신</li>
 *   <li>PING 수신 시 PONG 즉시 반환으로 연결 생존 확인(heartbeat) 처리</li>
 *   <li>NEW 주문 요청: 최소 주문 금액 검증 후 매칭 엔진 TCP 포트로 명령 전달</li>
 *   <li>CANCEL 주문 요청: 취소 대상 orderId를 매칭 엔진으로 전달</li>
 * </ul>
 *
 * <h3>마켓 동적 라우팅 전략</h3>
 * <p>마켓 심볼(symbol)로부터 환경 변수 키를 런타임에 자동 유도하여 매칭 엔진 소켓에 동적으로 라우팅함.
 * 코드 수정 없이 새로운 마켓을 추가할 수 있도록 설계됨.</p>
 *
 * <p>환경 변수 네이밍 규칙 (symbol "BTC-USD" → 환경 변수 접두어 "BTC_USD"):</p>
 * <ul>
 *   <li>{PREFIX}_ENGINE_HOST : 매칭 엔진 호스트 (예: ADA_KRW_ENGINE_HOST)</li>
 *   <li>{PREFIX}_COMMAND_PORT : 매칭 엔진 명령 수신 TCP 포트 (예: ADA_KRW_COMMAND_PORT)</li>
 * </ul>
 *
 * <p>BTC-USD 하위 호환: 기존 배포 환경과의 호환성을 위해 BTC-USD는 ENGINE_HOST / COMMAND_PORT 키를 우선 사용함.</p>
 *
 * <h3>TCP 소켓 관리 전략</h3>
 * <p>마켓별 소켓과 출력 스트림을 Map으로 관리하며, 연결이 끊어진 경우 다음 요청 시 자동으로 재접속(lazy reconnect)함.</p>
 */
public final class WsHandler extends SimpleChannelInboundHandler<Object> {

    private static final Logger log = LoggerFactory.getLogger(WsHandler.class);

    // 현재 연결 중인 모든 웹소켓 클라이언트 채널을 관리하는 그룹 (브로드캐스트, 접속자 수 집계 등에 활용)
    private final ChannelGroup clients;

    // 마켓(symbol)별 매칭 엔진 TCP 소켓 맵: key = symbol (예: "BTC-USD"), value = Socket 인스턴스
    // 연결 수립 시 동적으로 등록되고, 연결 해제 또는 오류 발생 시 제거 후 재접속 유도
    private final Map<String, Socket> engineSocketMap = new HashMap<>();

    // 마켓(symbol)별 매칭 엔진 TCP 출력 스트림 맵: key = symbol, value = PrintWriter 인스턴스
    // engineSocketMap과 항상 동기화되어 유지됨
    private final Map<String, PrintWriter> engineWriterMap = new HashMap<>();

    /**
     * 핸들러 생성자.
     * 소켓 연결은 지연 초기화(lazy init) 방식으로, 첫 요청 시점에 동적으로 수행됨.
     *
     * @param clients 현재 연결된 웹소켓 채널 그룹
     */
    public WsHandler(ChannelGroup clients) {
        this.clients = clients;
    }

    /**
     * 채널 파이프라인에 핸들러가 등록될 때 Netty가 호출하는 생명주기 메서드.
     * 현재는 별도 초기화 로직 없음. 소켓 연결은 첫 요청 수신 시 자동 수행됨.
     */
    @Override
    public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
        // 소켓 연결은 sendToEngine()에서 지연 초기화하므로 이곳에서는 별도 처리 불필요
    }

    /**
     * 채널 파이프라인에서 핸들러가 제거될 때(클라이언트 연결 해제) Netty가 호출하는 생명주기 메서드.
     * 클라이언트 그룹에서 해당 채널을 제거하고, 보유 중인 모든 엔진 TCP 소켓을 정리(close)함.
     */
    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
        log.info("Client disconnected: {}", ctx.channel().remoteAddress());
        // 연결 해제된 채널을 클라이언트 그룹에서 제거하여 불필요한 브로드캐스트 대상에서 배제
        clients.remove(ctx.channel());
        // 동시 접속 카운터 감소 (메트릭 대시보드 반영)
        WsMetricsServer.getInstance().decrementConnections();
        // 이 핸들러 인스턴스가 보유한 모든 마켓 엔진 소켓 자원을 반환
        closeAllSockets();
    }

    /**
     * Netty에서 사용자 정의 이벤트가 발생할 때 호출됨.
     * 웹소켓 핸드셰이크 완료 이벤트({@link WebSocketServerProtocolHandler.HandshakeComplete})를 감지하여
     * 해당 채널을 클라이언트 그룹에 등록하고, 동시 접속 카운터를 증가시킴.
     */
    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        if (evt instanceof WebSocketServerProtocolHandler.HandshakeComplete) {
            // 웹소켓 핸드셰이크 정상 완료 → 정식 클라이언트 채널로 등록
            clients.add(ctx.channel());
            WsMetricsServer.getInstance().incrementConnections();
            log.info("WebSocket connection established with: {}", ctx.channel().remoteAddress());
        } else {
            super.userEventTriggered(ctx, evt);
        }
    }

    /**
     * 웹소켓 텍스트 프레임 수신 시 호출되는 핵심 메시지 처리 메서드.
     *
     * <p>수신된 JSON 텍스트를 파싱하여 {@code action} 타입에 따라 분기 처리함.</p>
     * <ul>
     *   <li>{@code PING}: 클라이언트 하트비트 확인 → PONG 즉시 반환</li>
     *   <li>{@code NEW}: 매수/매도 신규 주문 → 최소 주문 금액 검증 후 해당 마켓 엔진에 전달</li>
     *   <li>{@code CANCEL}: 주문 취소 → orderId를 해당 마켓 엔진에 전달</li>
     * </ul>
     *
     * <p>JSON 파싱 오류나 알 수 없는 액션은 error 로그 처리하고 조용히 무시함.</p>
     */
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Exception {
        if (!(msg instanceof TextWebSocketFrame)) {
            // 텍스트 프레임이 아닌 경우(예: 바이너리 프레임)는 처리 대상 외
            return;
        }

        String text = ((TextWebSocketFrame) msg).text();
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(text);

            // action 필드로 명령 유형 식별. 값이 없거나 알 수 없는 경우 처리 없이 종료
            String action = node.has("action") ? node.get("action").asText() : "";
            // symbol 필드로 대상 마켓 식별. 미제공 시 기본값 BTC-USD 사용
            String symbol = node.has("symbol") ? node.get("symbol").asText() : "BTC-USD";

            // ── 1. PING 처리 ───────────────────────────────────────────────────────────
            // 클라이언트가 보낸 timestamp를 PONG에 그대로 담아 반환 (RTT 측정 및 연결 유지 확인)
            if ("PING".equalsIgnoreCase(action)) {
                long timestamp = node.has("timestamp") ? node.get("timestamp").asLong() : 0;
                String pong = String.format("{\"action\":\"PONG\",\"timestamp\":%d}", timestamp);
                ctx.channel().writeAndFlush(new TextWebSocketFrame(pong));
                WsMetricsServer.getInstance().incrementMessages();
                return;
            }

            // ── 2. NEW 주문 처리 ────────────────────────────────────────────────────────
            if ("NEW".equalsIgnoreCase(action)) {
                // 필수 파라미터 파싱
                String side = node.has("side")   ? node.get("side").asText()   : "";
                long price  = node.has("price")  ? node.get("price").asLong()  : 0;
                long qty    = node.has("qty")     ? node.get("qty").asLong()    : 0;
                // userId 미제공 시 기본값 1 (시스템 테스트 계정)
                long userId = node.has("userId") ? node.get("userId").asLong() : 1;

                // side, price, qty 모두 유효한 경우에만 주문 처리 진행
                if (!side.isEmpty() && price > 0 && qty > 0) {
                    // 2-1. 해당 마켓의 최소 주문 금액(minAmt) 조회
                    java.math.BigDecimal minAmt = MarketConfigManager.getInstance().getMinAmt(symbol);

                    if (minAmt.compareTo(java.math.BigDecimal.ZERO) > 0) {
                        // 2-2. 마켓 소수점 자릿수(decimals) 기반으로 실제 주문 총액 산출
                        //      공식: totalAmt = (price × qty) ÷ (10 ^ decimals)
                        int decimals = MarketConfigManager.getInstance().getDecimals(symbol);
                        java.math.BigDecimal scaleFactor = java.math.BigDecimal.TEN.pow(decimals);
                        java.math.BigDecimal totalAmt = java.math.BigDecimal.valueOf(price)
                                .multiply(java.math.BigDecimal.valueOf(qty))
                                .divide(scaleFactor);

                        // 2-3. 최소 주문 금액 미달 시 REJECT 메시지를 클라이언트에 반환하고 주문 중단
                        if (totalAmt.compareTo(minAmt) < 0) {
                            String rejectMsg = String.format(
                                    "{\"action\":\"REJECT\",\"symbol\":\"%s\",\"side\":\"%s\"," +
                                    "\"price\":%d,\"qty\":%d,\"reason\":\"Minimum order amount requirement not met.\"}",
                                    symbol, side.toUpperCase(), price, qty
                            );
                            ctx.channel().writeAndFlush(new TextWebSocketFrame(rejectMsg));
                            return;
                        }
                    }

                    // 2-4. 유효한 주문이면 CSV 형식으로 변환 후 해당 마켓 엔진으로 전달
                    //      엔진 프로토콜 규격: "NEW,[BUY/SELL],[가격(long)],[수량(long)],[유저 UID(long)]"
                    String cmd = String.format("NEW,%s,%d,%d,%d", side.toUpperCase(), price, qty, userId);
                    sendToEngine(symbol, cmd);
                    WsMetricsServer.getInstance().incrementMessages();
                }

            // ── 3. CANCEL 주문 처리 ─────────────────────────────────────────────────────
            } else if ("CANCEL".equalsIgnoreCase(action)) {
                long orderId = node.has("orderId") ? node.get("orderId").asLong() : 0;
                if (orderId > 0) {
                    // 엔진 프로토콜 규격: "CANCEL,[주문 ID(long)]"
                    String cmd = String.format("CANCEL,%d", orderId);
                    sendToEngine(symbol, cmd);
                    WsMetricsServer.getInstance().incrementMessages();
                }
            }

        } catch (Exception e) {
            log.error("Failed to process incoming WS frame: {}, error: {}", text, e.getMessage());
        }
    }

    /**
     * 채널에서 예외 발생 시 호출됨.
     * 에러 로그를 기록하고 채널을 강제 종료하여 자원 누수를 방지함.
     */
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        log.error("WS client exception: ", cause);
        ctx.close();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 매칭 엔진 TCP 소켓 관리 - 동적 마켓 라우팅
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * symbol에 해당하는 매칭 엔진 TCP 소켓으로 명령 문자열을 전송하는 내부 메서드.
     *
     * <h4>동작 방식</h4>
     * <ol>
     *   <li>Map에서 symbol에 해당하는 기존 소켓을 조회함</li>
     *   <li>소켓이 없거나 연결이 끊긴 경우, 환경 변수에서 동적으로 host/port를 유도하여 새로 접속함</li>
     *   <li>새 소켓을 Map에 등록하여 이후 요청에서 재사용함</li>
     *   <li>전송 실패 시 해당 소켓을 Map에서 제거하여 다음 요청 시 재접속을 유도함</li>
     * </ol>
     *
     * <p>동시에 여러 채널에서 호출될 수 있으므로 {@code synchronized}로 스레드 안전성을 보장함.</p>
     *
     * @param symbol 대상 마켓 심볼 (예: "BTC-USD", "ADA-KRW", "JAF-KRW")
     * @param cmd    엔진으로 전송할 CSV 형식 명령 문자열
     */
    private synchronized void sendToEngine(String symbol, String cmd) {
        try {
            Socket socket = engineSocketMap.get(symbol);
            PrintWriter writer = engineWriterMap.get(symbol);

            // 소켓이 없거나 연결이 끊긴 경우 재접속 시도
            if (socket == null || socket.isClosed() || !socket.isConnected()) {
                // symbol에서 환경변수 키를 동적으로 유도하여 host/port 조회
                String host = resolveEngineHost(symbol);
                int port    = resolveEnginePort(symbol);
                log.info("Connecting to Matching Engine ({}) at {}:{}", symbol, host, port);

                socket = new Socket(host, port);
                writer = new PrintWriter(socket.getOutputStream(), true);

                // 새로 생성한 소켓을 Map에 등록 (이후 재사용)
                engineSocketMap.put(symbol, socket);
                engineWriterMap.put(symbol, writer);
            }

            // 명령 전송 및 버퍼 즉시 플러시 (실시간 처리 지연 방지)
            writer.println(cmd);
            writer.flush();

        } catch (Exception e) {
            log.error("Error sending command to Matching Engine ({}): {}", symbol, e.getMessage());
            // 전송 실패 시 해당 소켓을 제거하여 다음 요청에서 새 연결 수립 유도
            closeSocket(symbol);
        }
    }

    /**
     * symbol로부터 매칭 엔진 호스트를 동적으로 유도함.
     *
     * <h4>환경 변수 키 유도 규칙</h4>
     * <p>symbol의 {@code -}를 {@code _}로 치환한 뒤 대문자화하여 접두어를 생성함.</p>
     * <pre>
     *   "BTC-USD" → ENGINE_HOST           (기존 .env 배포 환경 하위 호환)
     *   "ADA-KRW" → ADA_KRW_ENGINE_HOST
     *   "JAF-KRW" → JAF_KRW_ENGINE_HOST
     *   "JAF-USD" → JAF_USD_ENGINE_HOST
     * </pre>
     *
     * @param symbol 대상 마켓 심볼
     * @return 해당 마켓 엔진의 호스트 주소
     */
    private String resolveEngineHost(String symbol) {
        if ("BTC-USD".equalsIgnoreCase(symbol)) {
            // BTC-USD는 기존 배포 환경과의 호환을 위해 레거시 키(ENGINE_HOST)를 사용
            return ConfigLoader.get("ENGINE_HOST", "localhost");
        }
        // 그 외 마켓: "{SYMBOL_UPPER_UNDERSCORE}_ENGINE_HOST" 키를 동적으로 구성하여 조회
        String envKey = toEnvPrefix(symbol) + "_ENGINE_HOST";
        return ConfigLoader.get(envKey, ConfigLoader.get("ENGINE_HOST", "localhost"));
    }

    /**
     * symbol로부터 매칭 엔진 TCP 명령 수신 포트를 동적으로 유도함.
     *
     * <h4>환경 변수 키 유도 규칙</h4>
     * <pre>
     *   "BTC-USD" → COMMAND_PORT           (기존 .env 배포 환경 하위 호환, 기본값: 9999)
     *   "ADA-KRW" → ADA_KRW_COMMAND_PORT   (기본값: 9997)
     *   "JAF-KRW" → JAF_KRW_COMMAND_PORT   (기본값: 9995)
     *   "JAF-USD" → JAF_USD_COMMAND_PORT   (기본값: 9994)
     * </pre>
     *
     * @param symbol 대상 마켓 심볼
     * @return 해당 마켓 엔진의 명령 수신 TCP 포트 번호
     */
    private int resolveEnginePort(String symbol) {
        if ("BTC-USD".equalsIgnoreCase(symbol)) {
            return ConfigLoader.getInt("COMMAND_PORT", 9999);
        }
        // 그 외 마켓: "{SYMBOL_UPPER_UNDERSCORE}_COMMAND_PORT" 키를 동적으로 구성하여 조회
        String envKey = toEnvPrefix(symbol) + "_COMMAND_PORT";
        return ConfigLoader.getInt(envKey, 9999);
    }

    /**
     * 마켓 심볼을 환경 변수 접두어 형식으로 변환하는 유틸리티 메서드.
     * <pre>
     *   "ADA-KRW"  →  "ADA_KRW"
     *   "JAF-USD"  →  "JAF_USD"
     * </pre>
     *
     * @param symbol 마켓 심볼 문자열
     * @return 환경 변수 접두어 (대문자, 하이픈 → 언더스코어 변환)
     */
    private static String toEnvPrefix(String symbol) {
        return symbol.replace("-", "_").toUpperCase();
    }

    /**
     * 지정한 마켓 심볼에 해당하는 TCP 소켓 연결을 안전하게 종료하고 Map에서 제거함.
     * 소켓 종료 중 발생하는 예외는 무시함(이미 닫힌 소켓 등의 상황 처리).
     *
     * @param symbol 종료 대상 마켓 심볼
     */
    private synchronized void closeSocket(String symbol) {
        try {
            PrintWriter writer = engineWriterMap.remove(symbol);
            Socket socket      = engineSocketMap.remove(symbol);
            if (writer != null) writer.close();
            if (socket != null) socket.close();
        } catch (Exception ignored) {
            // 종료 중 발생하는 IOException은 무시 (이미 닫힌 소켓 등)
        }
    }

    /**
     * 이 핸들러가 보유한 모든 마켓 엔진 TCP 소켓을 일괄 종료함.
     * 클라이언트 연결 해제({@link #handlerRemoved}) 시 자동 호출됨.
     * Map의 키 목록을 복사한 뒤 순회하여 ConcurrentModificationException을 방지함.
     */
    private void closeAllSockets() {
        // Map 순회 중 closeSocket()이 Map을 수정하므로 키 목록을 미리 복사하여 안전하게 처리
        new HashSet<>(engineSocketMap.keySet()).forEach(this::closeSocket);
    }
}
