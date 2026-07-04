package exchange.generator;

import java.io.PrintWriter;
import java.net.Socket;
import java.util.Random;

/**
 * <h1>실시간 가상 거래 주문 생성기 (Order Generator)</h1>
 * <p>
 * 이 클래스는 매칭 엔진(Matching Engine)에 실시간으로 가상 매수/매도 주문을 지속적으로 주입하는 테스트 데몬입니다.
 * 초고속 인메모리 FIFO 매칭 엔진의 부하 테스트 및 프론트엔드 호가창의 실시간 스트리밍 시각화를 지원하기 위해 설계되었습니다.
 * </p>
 */
public final class OrderGenerator {
    // 멀티스레드 환경에서 안전하게 전체 누적 주문 수를 측정하기 위한 원자적 정수형 카운터
    private static final java.util.concurrent.atomic.AtomicInteger totalOrderCount = new java.util.concurrent.atomic.AtomicInteger(
            0);
    // 환경변수 또는 프로필 설정(MAX_ORDERS)으로부터 수신하며, 없을 시 무한 생성을 위해 정수형 최대치(약 21억 건)로 설정
    private static final int MAX_ORDERS = ConfigLoader.getInt("MAX_ORDERS", Integer.MAX_VALUE);

    // 주문 간격 속도 제어용 환경변수 (기본값: 최소 50ms, 최대 250ms)
    private static final int ENV_SLEEP_MIN_MS = ConfigLoader.getInt("GENERATOR_SLEEP_MIN", 50);
    private static final int ENV_SLEEP_MAX_MS = ConfigLoader.getInt("GENERATOR_SLEEP_MAX", 250);

    public static void main(String[] args) {
        int sleepMin = ENV_SLEEP_MIN_MS;
        int sleepMax = ENV_SLEEP_MAX_MS;

        // 사용자가 커맨드라인 아규먼트(변수)로 명시적 값을 넘겼을 경우 이를 최우선으로 적용
        if (args.length >= 2) {
            try {
                sleepMin = Integer.parseInt(args[0]);
                sleepMax = Integer.parseInt(args[1]);
                System.out.println("Applied custom sleep args: " + sleepMin + "ms ~ " + sleepMax + "ms");
            } catch (NumberFormatException e) {
                System.out.println("Invalid sleep args. Falling back to env values.");
            }
        }
        // 환경 변수 및 config 파일로부터 대상 매칭 엔진의 IP 호스트와 포트를 바인딩
        String btcHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        String adaHost = ConfigLoader.get("ADA_ENGINE_HOST", btcHost);
        String jafKrwHost = ConfigLoader.get("JAF_KRW_ENGINE_HOST", btcHost);
        String jafUsdHost = ConfigLoader.get("JAF_USD_ENGINE_HOST", btcHost);

        // BTC-USD(비트코인) 주문 수신용 TCP 포트 (기본값: 9999)
        int btcPort = ConfigLoader.getInt("COMMAND_PORT", 9999);
        // ADA-KRW(에이다) 주문 수신용 TCP 포트 (기본값: 9997)
        int adaPort = ConfigLoader.getInt("ADA_COMMAND_PORT", 9997);
        // JAF-KRW(자프 원화) 주문 수신용 TCP 포트 (기본값: 9995)
        int jafKrwPort = ConfigLoader.getInt("JAF_KRW_COMMAND_PORT", 9995);
        // JAF-USD(자프 달러) 주문 수신용 TCP 포트 (기본값: 9994)
        int jafUsdPort = ConfigLoader.getInt("JAF_USD_COMMAND_PORT", 9994);

        System.out.println("Starting Multi-Symbol Order Generator...");
        System.out.println("Target Matching Engines:");
        System.out.println(" - BTC-USD command port: " + btcHost + ":" + btcPort);
        System.out.println(" - ADA-KRW command port: " + adaHost + ":" + adaPort);
        System.out.println(" - JAF-KRW command port: " + jafKrwHost + ":" + jafKrwPort);
        System.out.println(" - JAF-USD command port: " + jafUsdHost + ":" + jafUsdPort);
        System.out.println(
                " - Max orders limit: " + (MAX_ORDERS == Integer.MAX_VALUE ? "UNLIMITED" : MAX_ORDERS + " orders"));

        // 1. 비트코인(BTC-USD) 가상 주문 주입을 담당하는 스레드 생성 (BTC 소수점 8자리 스케일 100,000,000)
        long btcScale = 100000000L;
        Thread btcThread = new Thread(
                new GeneratorTask(btcHost, btcPort, 65000L * btcScale, "BTC-USD", btcScale, sleepMin, sleepMax),
                "generator-btc");
        // 2. 에이다(ADA-KRW) 가상 주문 주입을 담당하는 스레드 생성 (ADA 소수점 4자리 스케일 10,000)
        long adaScale = 10000L;
        Thread adaThread = new Thread(
                new GeneratorTask(adaHost, adaPort, 500L * adaScale, "ADA-KRW", adaScale, sleepMin, sleepMax),
                "generator-ada");
        // 3. 자프 원화(JAF-KRW) 가상 주문 주입 담당 스레드 생성 (소수점 4자리 스케일 10,000, 기준가: 1500)
        long jafKrwScale = 10000L;
        Thread jafKrwThread = new Thread(
                new GeneratorTask(jafKrwHost, jafKrwPort, 1500L * jafKrwScale, "JAF-KRW", jafKrwScale, sleepMin, sleepMax),
                "generator-jaf-krw");
        // 4. 자프 달러(JAF-USD) 가상 주문 주입 담당 스레드 생성 (소수점 8자리 스케일 100,000,000, 기준가: 1)
        long jafUsdScale = 100000000L;
        Thread jafUsdThread = new Thread(
                new GeneratorTask(jafUsdHost, jafUsdPort, 1L * jafUsdScale, "JAF-USD", jafUsdScale, sleepMin, sleepMax),
                "generator-jaf-usd");

        // 각 마켓별 주문 인젝터 스레드 동시 구동
        btcThread.start();
        adaThread.start();
        jafKrwThread.start();
        jafUsdThread.start();

        try {
            // 프로세스가 임의로 종료되지 않도록 작업 완료 시까지 메인 스레드를 정지 상태로 유지
            btcThread.join();
            adaThread.join();
            jafKrwThread.join();
            jafUsdThread.join();
        } catch (InterruptedException e) {
            System.err.println("Main thread interrupted.");
        }
    }

    /**
     * <h2>개별 마켓 주문 생성 태스크 클래스</h2>
     * 지정된 매칭 엔진 command 포트로 소켓을 연결하고 실시간 랜덤 호가 주문을 주입합니다.
     */
    private static class GeneratorTask implements Runnable {
        private final String host; // 매칭 엔진 IP/호스트 주소
        private final int port; // 매칭 엔진 TCP 커맨드 수신 포트
        private long referencePrice; // 변동성의 기준이 되는 실시간 시세 기준값
        private final String symbol; // 대상 마켓 심볼명 (BTC-USD, ADA-KRW 등)
        private final long scale; // 마켓 소수점 스케일 팩터
        private final int sleepMin; // 딜레이 최소값
        private final int sleepMax; // 딜레이 최대값

        public GeneratorTask(String host, int port, long referencePrice, String symbol, long scale, int sleepMin,
                int sleepMax) {
            this.host = host;
            this.port = port;
            this.referencePrice = referencePrice;
            this.symbol = symbol;
            this.scale = scale;
            this.sleepMin = sleepMin;
            this.sleepMax = sleepMax;
        }

        @Override
        public void run() {
            Random rand = new Random();
            long retryDelay = 1000; // 네트워크 통신 장애 시 재연결 간격 기본값 (1초)

            while (totalOrderCount.get() < MAX_ORDERS) {
                // 매칭 엔진의 TCP 소켓 서버에 커넥션 수립
                try (Socket socket = new Socket(host, port);
                        PrintWriter writer = new PrintWriter(socket.getOutputStream(), true)) {

                    System.out.println(
                            "[" + symbol + "] Connected to matching engine command port! Generating trades...");
                    retryDelay = 1000; // 연결 성공 시 재연결 대기 시간 1초로 재초기화

                    // [커넥션 성공 즉시 수행] 호가창을 촘촘하고 두껍게 형성하기 위해 50개(매도 25레벨, 매수 25레벨)의 대용량 초기 시드북 데이터 강제
                    // 주입
                    generateInitialSeedBook(writer);

                    // 지속적으로 실시간 호가/체결 주문을 주입하는 핵심 트레이딩 루프
                    while (totalOrderCount.get() < MAX_ORDERS) {
                        // 1. 주문 유형 결정: 매수(BUY)와 매도(SELL) 확률을 정확히 50% 반반으로 나눔
                        String side = rand.nextBoolean() ? "BUY" : "SELL";

                        // 2. 호가 격차(Price Offset) 산정: 호가창(OrderBook)의 물량 그룹핑을 위해 가격은 특정 틱 단위로 제한
                        long priceOffset;
                        if (symbol.equalsIgnoreCase("BTC-USD") || symbol.equalsIgnoreCase("JAF-USD")) {
                            // BTC-USD / JAF-USD: -15 ~ +14 달러/센트 (정수 단위)
                            priceOffset = (rand.nextInt(30) - 15) * scale;
                        } else {
                            // ADA-KRW / JAF-KRW: -3 ~ +2 원 (정수 단위)
                            priceOffset = (rand.nextInt(6) - 3) * scale;
                        }
                        long price = referencePrice + priceOffset;

                        // 3. 최저 호가 한계선(보호 가드) 산정: 호가가 음수 또는 비정상 가격으로 하락하지 않도록 제한
                        long minPrice;
                        if (symbol.equalsIgnoreCase("BTC-USD")) {
                            minPrice = 10000L * scale;
                        } else if (symbol.equalsIgnoreCase("JAF-USD")) {
                            minPrice = (long) (0.1 * scale); // 최저 0.1 USD
                        } else if (symbol.equalsIgnoreCase("JAF-KRW")) {
                            minPrice = 100L * scale; // 최저 100 KRW
                        } else {
                            minPrice = 10L * scale; // ADA: 최저 10 KRW
                        }

                        if (price < minPrice) {
                            price = minPrice;
                        }

                        // 4. 주문 수량(Qty) 산정: 종목에 맞는 현실적인 소수점 수량 생성 후 스케일업
                        long qty;
                        if (symbol.equalsIgnoreCase("BTC-USD")) {
                            qty = (long) (scale * (0.001 + rand.nextDouble() * 0.499));
                        } else if (symbol.equalsIgnoreCase("JAF-USD")) {
                            qty = (long) (scale * (0.001 + rand.nextDouble() * 99.999));
                        } else if (symbol.equalsIgnoreCase("JAF-KRW")) {
                            qty = (long) (scale * (0.01 + rand.nextDouble() * 999.99));
                        } else {
                            qty = (long) (scale * (0.01 + rand.nextDouble() * 99.99));
                        }
                        // 5. 가상 유저 UID 할당: 1~1000번 사이의 1000명 랜덤 회원으로 할당하여 골고루 트랜잭션이 일어나도록 설계
                        long userId = rand.nextInt(1000) + 1;

                        // 누적 주문 수가 한계치를 넘었는지 확인 및 원자적 값 1 증가
                        if (totalOrderCount.incrementAndGet() > MAX_ORDERS) {
                            System.out.println("[" + symbol + "] Target order limit of " + MAX_ORDERS
                                    + " reached. Exiting generator loop.");
                            break;
                        }

                        // 6. 매칭 엔진의 TCP 라인 프로토콜 양식에 맞춰 원시 문자열 명령(CSV) 발송
                        // 프로토콜 규격: "NEW,[BUY/SELL],[가격(long)],[수량(long)],[유저 UID(long)]"
                        writer.println(String.format("NEW,%s,%d,%d,%d", side, price, qty, userId));
                        writer.flush(); // 즉시 소켓 버퍼 비우기(실시간 스트리밍 지연 방지)

                        // 7. 기준값 트렌드 변동: 5% 확률로 시장의 대세 흐름 가격(Reference Price) 자체를 동적 이동시켜 차트 우상향/우하향 연출
                        if (rand.nextInt(100) < 5) {
                            if (symbol.equalsIgnoreCase("BTC-USD") || symbol.equalsIgnoreCase("JAF-USD")) {
                                referencePrice += (rand.nextInt(10) - 5) * scale; // -5 ~ +4 달러/센트
                            } else {
                                referencePrice += (rand.nextInt(4) - 2) * scale; // -2 ~ +1 원
                            }
                            if (referencePrice < minPrice) {
                                referencePrice = minPrice;
                            }
                        }

                        // 8. 초고속 주입 과부하 및 지연 제어 장치: 설정된 범위 내의 랜덤 슬립
                        int bound = Math.max(1, sleepMax - sleepMin);
                        Thread.sleep(sleepMin + rand.nextInt(bound));
                    }

                } catch (Exception e) {
                    // 네트워크 장애 등으로 끊겼을 경우 안전하게 리커버리 진행
                    if (totalOrderCount.get() >= MAX_ORDERS) {
                        break;
                    }
                    System.err.println("[" + symbol + "] Lost connection: " + e.getMessage());
                    System.err.println("[" + symbol + "] Reconnecting in " + retryDelay + "ms...");
                    try {
                        // 지연 시간을 Exponential Backoff(2배씩 지수형 증가) 형태로 대기하여 엔진 부하 및 커넥션 스톰 방지 (최대 30초 대기)
                        Thread.sleep(retryDelay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                    retryDelay = Math.min(retryDelay * 2, 30000);
                }
            }
            System.out.println("[" + symbol + "] Generator task stopped successfully.");
        }

        /**
         * <h3>25레벨 두께의 초기 호가 데이터(Seed Book) 구성 메서드</h3>
         * 매칭 엔진 구동 초기 또는 소켓 접속 즉시 호가창 붕괴를 막고 매칭 대기열을 충분히 구성하기 위해 사용됩니다.
         */
        private void generateInitialSeedBook(PrintWriter writer) {
            System.out.println("[" + symbol + "] Generating initial 25-level thick seed book...");
            Random r = new Random();

            // 1. 매도(SELL) 대기열 25단계 생성: 기준가 위쪽으로 대량 물량 주입
            for (int i = 1; i <= 25; i++) {
                long price = referencePrice + i * scale; // 정수 1틱(달러/원) 단위 깊이
                long qty;
                if (symbol.equalsIgnoreCase("BTC-USD")) {
                    qty = (long) (scale * (0.01 + r.nextDouble() * 2.0)); // 0.01 ~ 2.0 BTC
                } else if (symbol.equalsIgnoreCase("JAF-USD")) {
                    qty = (long) (scale * (0.1 + r.nextDouble() * 10.0)); // 0.1 ~ 10.1 JAF
                } else if (symbol.equalsIgnoreCase("JAF-KRW")) {
                    qty = (long) (scale * (10 + r.nextDouble() * 500)); // 10 ~ 510 JAF
                } else {
                    qty = (long) (scale * (100 + r.nextDouble() * 5000)); // 100 ~ 5100 ADA
                }
                long userId = r.nextInt(1000) + 1;
                writer.println(String.format("NEW,SELL,%d,%d,%d", price, qty, userId));
            }

            // 매수 25단계 깊이 주입 (현재가보다 낮게)
            for (int i = 1; i <= 25; i++) {
                long price = referencePrice - i * scale;
                long qty;
                if (symbol.equalsIgnoreCase("BTC-USD")) {
                    qty = (long) (scale * (0.01 + r.nextDouble() * 2.0));
                } else if (symbol.equalsIgnoreCase("JAF-USD")) {
                    qty = (long) (scale * (0.1 + r.nextDouble() * 10.0));
                } else if (symbol.equalsIgnoreCase("JAF-KRW")) {
                    qty = (long) (scale * (10 + r.nextDouble() * 500));
                } else {
                    qty = (long) (scale * (100 + r.nextDouble() * 5000));
                }
                long userId = r.nextInt(1000) + 1;
                writer.println(String.format("NEW,BUY,%d,%d,%d", price, qty, userId));
            }
            writer.flush();
            System.out.println("[" + symbol + "] Seed book injection completed successfully for " + symbol);
        }
    }
}
