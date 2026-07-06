/**
 * [개발/성능 주의 사항]
 * 1. 구조 및 라인 길이:
 *    - 본 파일은 약 710라인으로 상태 관리, 웹소켓 연결, RTR 토큰 갱신 로직이 통합되어 있습니다.
 *    - 규모가 커질 경우 유지보수를 위해 인증 로직(fetchWithAuth) 및 파싱 유틸리티를 별도 파일로 분리하는 것을 권장합니다.
 * 
 * 2. 실시간 오더북 정렬 연산 부하:
 *    - `startUpdateLoop` 내부에서 30ms 주기로 `bidsMap`과 `asksMap` 전체를 배열로 변환한 후 `sort()`를 수행합니다.
 *    - 가격 수준(Price Level) 데이터의 개수가 과도하게 많아지면 CPU 부하 및 가비지 컬렉션(GC) 병목이 생길 수 있으므로,
 *      필요 시 깊이(depth) 제한을 두거나 삽입 시 정렬 상태를 유지하도록 개선해야 합니다.
 * 
 * 3. Zustand 구독 시 Selector 필수 사용:
 *    - 본 스토어에는 초고속 실시간 데이터(bids, asks, latency 등)와 정적 데이터(isAuthenticated, authEmail 등)가 함께 존재합니다.
 *    - 컴포넌트에서 구조 분해 할당 등으로 스토어 전체를 구독하면(예: `const { authEmail } = useExchangeStore()`),
 *      30ms마다 일어나는 실시간 업데이트 때문에 불필요한 전체 리렌더링이 발생합니다.
 *    - 반드시 개별 셀렉터를 지정하여 구독하십시오. (예: `const authEmail = useExchangeStore(state => state.authEmail)`)
 */

import { create } from 'zustand';

// 문자열 해시코드 계산 도우미 (Java의 String.hashCode() 구현체)
export function getHashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // 32비트 정수로 캐스팅
    }
    return Math.abs(hash);
}

// 실시간 체결 로그 인터페이스
export interface TradeLog {
    tradeId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    qty: number;
    executedAt: string;
}

// 캔들 정보 인터페이스
export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

// TODO(security): localStorage is vulnerable to XSS token theft.
// In a production release, these authentication tokens should be stored in secure, HttpOnly cookies.
const getLocalAccessToken = () => localStorage.getItem('user_access_token');
const getLocalRefreshToken = () => localStorage.getItem('user_refresh_token');
const setLocalTokens = (access: string | null, refresh: string | null) => {
    if (access) localStorage.setItem('user_access_token', access);
    else localStorage.removeItem('user_access_token');
    if (refresh) localStorage.setItem('user_refresh_token', refresh);
    else localStorage.removeItem('user_refresh_token');
};

/**
 * 🔐 자동 RTR(Refresh Token Rotation) 기능이 내장된 인증 전용 API 요청 Wrapper
 * 1. 로컬 스토리지에 저장된 Access Token을 조회하여 API 헤더의 'Authorization'에 주입합니다.
 * 2. API가 만료 상태 코드(401 Unauthorized 또는 403 Forbidden)를 반환할 때 동작을 가로챕니다.
 * 3. 저장된 Refresh Token이 존재한다면, `/admin/auth/refresh` API에 토큰 갱신을 요청합니다.
 * 4. 토큰 갱신에 성공하는 경우:
 *    - 새로운 Access/Refresh Token 쌍을 로컬 스토리지에 안전하게 교체 저장합니다.
 *    - 새로 발급받은 Access Token을 원래 요청의 헤더에 재주입하고, API 요청을 백그라운드에서 투명하게 재시도합니다.
 * 5. 토큰 갱신에 실패하는 경우:
 *    - 세션 및 로컬 스토리지를 즉시 초기화하여 안전하게 로그아웃하고 새로고침을 통해 무한 세션 만료 깜빡임을 방지합니다.
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let access = getLocalAccessToken();
    if (!options.headers) {
        options.headers = {};
    }
    if (access) {
        (options.headers as any)['Authorization'] = `Bearer ${access}`;
    }

    let res = await fetch(url, options);

    // 401 Unauthorized 또는 403 Forbidden 시 Refresh Token 기반 RTR 토큰 교체 자동 개시
    if ((res.status === 401 || res.status === 403) && getLocalRefreshToken()) {
        try {
            console.log("[Auth] 토큰 만료 또는 비인가 요청 차단 감지. Refresh Token으로 갱신 수행 중...");
            const origin = new URL(url).origin;
            const refreshRes = await fetch(`${origin}/admin/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: getLocalRefreshToken() })
            });
            if (refreshRes.ok) {
                const tokens = await refreshRes.json();
                setLocalTokens(tokens.accessToken, tokens.refreshToken);
                // 새로 발급받은 Access Token 재주입 후 원래 요청 재시도
                (options.headers as any)['Authorization'] = `Bearer ${tokens.accessToken}`;
                res = await fetch(url, options);
            } else {
                console.warn("[Auth] Refresh Token 세션 갱신 실패. 강제 로그아웃됨.");
                setLocalTokens(null, null);
                localStorage.removeItem('user_auth_email');
                localStorage.removeItem('user_auth_id');
                // 무한 루프나 세션 만료 깜빡임을 막기 위해, 로그인 상태가 활성화되어 있었던 경우에만 새로고침을 트리거합니다.
                if (localStorage.getItem('user_access_token')) {
                    window.location.reload();
                }
            }
        } catch (e) {
            console.error("[Auth] 토큰 갱신 에러", e);
        }
    }
    return res;
};

/**
 * 📊 유저 거래소 중앙 상태 및 액션 인터페이스 (Zustand State)
 */
interface ExchangeState {
    /** API 호스트 기본 URL (기본값: http://localhost:8181, config.json에 의해 동적 설정 가능) */
    apiBaseUrl: string;
    /** 실시간 시세/오더북 웹소켓 스트림 URL (기본값: ws://localhost:8088/ws) */
    wsUrl: string;
    /** 현재 화면에 선택 및 활성화된 마켓 심볼 (예: 'BTC-USD', 'ADA-KRW') */
    activeSymbol: string;
    /** 차트에서 사용되는 캔들 봉 주기 해상도 (예: '1m', '5m', '1d' 등) */
    activeResolution: string;
    /** 실시간 웹소켓 서버 접속 여부 플래그 */
    wsConnected: boolean;
    /** 마지막으로 체결된 거래 가격 (Active Symbol 기준) */
    lastPrice: number;
    /** 누적 거래 횟수 */
    totalTradesCount: number;
    /** 누적 거래 대금/거래량 문자열 표시 포맷 */
    totalVolumeText: string;
    /** 실시간 체결 이력 로그 배열 (최대 50개 유지) */
    tradesLog: TradeLog[];
    /** 차트용으로 백엔드에서 조회해 적재한 캔들 봉 데이터 목록 */
    loadedCandles: CandleData[];

    // ⚡ 고성능 배치 렌더링용 실시간 오더북 및 계측 지표
    /** 10단 매수 호가 리스트 [가격(정수), 수량(정수)] */
    bids: [number, number][];
    /** 10단 매도 호가 리스트 [가격(정수), 수량(정수)] (화면 표시를 위해 오름차순 역정렬 유지) */
    asks: [number, number][];
    /** 매수최고가와 매도최저가의 중간 가격 (Mid Price) */
    midPrice: number;
    /** 최우선 매수호가와 최우선 매도호가의 차이 (Spread) */
    spread: number;
    /** 📊 체결 강도 (Volume Power): 최근 10초간의 BUY 수량 합산 / SELL 수량 합산 % 비율 */
    volumePower: number;
    /** 📶 네트워크 왕복 지연 시간 (Latency RTT - ms 단위) */
    latency: number;
    /** ⚡ 초당 수신 및 처리 중인 호가/체결 데이터 메시지 수 (Throughput - TPS) */
    throughput: number;

    // 인증 관련 상태 및 액션
    /** 세션이 유효하고 로그인된 상태인지 여부 */
    isAuthenticated: boolean;
    /** 현재 로그인한 유저 이메일 */
    authEmail: string | null;
    /** 현재 로그인한 유저 고유 ID (JWT 디코딩 결과) */
    authUserId: number | null;
    /** 로그인 모달 다이얼로그 표시 여부 */
    isLoginModalOpen: boolean;
    /** 로그인 모달의 열림/닫힘 상태를 제어하는 함수 */
    setLoginModalOpen: (open: boolean) => void;
    /** 이메일/비밀번호 기반 로그인 요청 액션 */
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    /** 신규 회원가입 요청 액션 */
    signup: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    /** 로그아웃 처리 액션 (로컬 토큰 파기 및 세션 해제) */
    logout: () => void;

    // 개인화 데이터 API 액션
    /** 현재 사용자 지갑의 통화별 잔고 조회 */
    fetchUserBalances: () => Promise<Record<string, number>>;
    /** 현재 사용자 본인의 체결 거래 목록 최신 50개 조회 */
    fetchUserTrades: () => Promise<any[]>;
    /** 현재 사용자 지갑의 입출금/거래 원장(Ledger) 변경 이력 최신 50개 조회 */
    fetchUserLedgers: () => Promise<any[]>;

    // 액션 메서드 선언
    /** 거래소 화면 로딩 시 config.json 연동, 호스트 자동 보정, 풀 스냅샷 연동, 웹소켓 초기화를 일괄 수행하는 진입점 */
    initStore: () => Promise<void>;
    /** 사용자가 마켓 심볼을 전환할 때 호출되어 호가 맵 초기화 및 새 스냅샷을 적재하는 액션 */
    setActiveSymbol: (symbol: string) => void;
    /** 차트 봉 주기(Resolution) 변경 액션 */
    setActiveResolution: (res: string) => void;
    /** 웹소켓 연결 상태 수동 변경 액션 */
    setWsConnected: (connected: boolean) => void;
    /** 체결 로그 및 통계를 외부 API 등을 통해 수동으로 갱신하는 폴백 메서드 */
    updateTradeStats: (price: number, qty: number, side: 'BUY' | 'SELL', symbol: string) => void;
    /** 불러온 캔들 목록을 전역 차트 상태에 주입하는 액션 */
    addLoadedCandles: (candles: CandleData[]) => void;
    /** 실시간 신규 체결 가격을 차트에 반영하도록 트리거를 전달하는 폴백 메서드 */
    addRealtimeTick: (price: number) => void;

    // ⚡ 고성능 모듈용 전역 액션
    /** 웹소켓 스트림 구독 전 매칭 엔진 전용 스냅샷 포트(9100/9101)로부터 완벽한 정합성의 호가창 풀 스냅샷 동기화 */
    fetchFullSnapshot: (symbol: string) => Promise<void>;
    /** 웹소켓 커넥션을 통해 백엔드에 즉각적으로 주문(Limit/Market 등) 바이너리/JSON 패킷을 송신 */
    sendOrder: (payload: any) => boolean;
    /** 전체 개설 마켓 목록 정보 */
    markets: any[];
    /** 사용 가능한 전체 마켓(심볼) 목록 및 각 심볼별 당일 시가/종가/현재가 정보를 조회하는 액션 */
    fetchMarkets: () => Promise<void>;
    tickerPrices: Record<string, { lastPrice: number; prevClosePrice: number }>;
    lastRejectEvent: {
        symbol: string;
        side: 'BUY' | 'SELL';
        price: number;
        qty: number;
        reason: string;
        timestamp: number;
    } | null;
    clearRejectEvent: () => void;
    getScaleFactor: (symbol?: string) => number;
    getTickSize: (symbol: string, humanPrice: number) => number;
}

// 심볼 해시코드 상수
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

export const useExchangeStore = create<ExchangeState>((set, get) => {
    let ws: WebSocket | null = null;

    // ⚡ 고성능 인메모리 버퍼 및 최적화 제어용 플래그
    const bidsMap = new Map<number, number>();
    const asksMap = new Map<number, number>();
    let recentTradesBuffer: TradeLog[] = [];
    let recentTradesPower: { side: number; qty: number; time: number }[] = [];
    let msgCount = 0;
    let updateTimer: any = null;
    let tpsTimer: any = null;
    let pingTimer: any = null;
    let reconnectTimer: any = null; // ⚡ 재접속 타이머 누수 방지 변수 추가
    let orderbookChanged = false; // ⚡ 오더북 실질 데이터 변경 플래그

    /**
     * ⚡ 고성능 30ms 스로틀 배치 업데이트 루프
     * - 웹소켓 수신 시 실시간으로 React 상태(Zustand `set()`)를 매번 변경하면 극심한 렌더링 병목 및 화면 멈춤이 발생합니다.
     * - 이를 방지하기 위해 웹소켓으로 들어오는 모든 업데이트는 인메모리 버퍼(`bidsMap`, `asksMap`, `recentTradesBuffer`)에 즉시 기록하고,
     *   30ms 주기(초당 약 33회)로만 호가 정렬, 체결 강도 계산 및 최종 상태 업데이트를 일괄 처리합니다.
     * - 데이터에 실질적인 변동이 없는 경우(`!hasNewTrades && !orderbookChanged`) 불필요한 가비지 컬렉션(GC) 및 렌더 가동을 원천 생략합니다.
     */
    const startUpdateLoop = () => {
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => {
            const currentSymbol = get().activeSymbol;
            const hasNewTrades = recentTradesBuffer.length > 0;

            // ⚡ 신규 체결 정보도 없고 오더북 변동도 없으면 렌더 업데이트 및 연산 전체 생략!
            if (!hasNewTrades && !orderbookChanged) return;

            // 1. 오더북 10단 파싱 및 화면용 반전 정렬
            const bidsArr = Array.from(bidsMap.entries())
                .sort((a, b) => b[0] - a[0])
                .slice(0, 10);
            const asksArr = Array.from(asksMap.entries())
                .sort((a, b) => a[0] - b[0])
                .slice(0, 10);

            const scale = get().getScaleFactor(currentSymbol);
            let mid = 0;
            let diff = 0;
            if (bidsArr.length > 0 && asksArr.length > 0) {
                const topBid = bidsArr[0][0] / scale;
                const topAsk = asksArr[0][0] / scale;
                mid = (topBid + topAsk) / 2.0;
                diff = topAsk - topBid;
            }

            // 2. 체결 강도(Volume Power) 계산
            const now = Date.now();
            recentTradesPower = recentTradesPower.filter(t => now - t.time < 10000);
            let buySum = 0;
            let sellSum = 0;
            recentTradesPower.forEach(t => {
                if (t.side === 1) buySum += t.qty;
                else sellSum += t.qty;
            });
            const power = sellSum > 0 ? (buySum / sellSum) * 100.0 : 100.0;

            // 3. 체결 내역 업데이트 및 상태 반영 (어드민과 100% 동일화)
            set((state) => {
                let nextLogs = state.tradesLog;
                const nextTickerPrices = { ...state.tickerPrices };
                if (hasNewTrades) {
                    recentTradesBuffer.forEach(t => {
                        const existing = nextTickerPrices[t.symbol] || { lastPrice: t.price, prevClosePrice: t.price };
                        nextTickerPrices[t.symbol] = {
                            ...existing,
                            lastPrice: t.price
                        };
                    });
                    nextLogs = [...recentTradesBuffer, ...nextLogs].slice(0, 50);
                    recentTradesBuffer = [];
                }

                const matchingLogs = nextLogs.filter(t => t.symbol === currentSymbol);
                const nextLastPrice = matchingLogs.length > 0 ? matchingLogs[0].price : state.lastPrice;

                const nextState: any = {
                    bids: bidsArr,
                    asks: [...asksArr].reverse(),
                    midPrice: mid,
                    spread: diff,
                    volumePower: power,
                    lastPrice: nextLastPrice,
                    tickerPrices: nextTickerPrices
                };

                if (hasNewTrades) {
                    nextState.tradesLog = nextLogs;
                }

                return nextState;
            });

            orderbookChanged = false; // ⚡ 플래그 초기화

            // 차트 캔들 실시간 갱신 유도
            const finalPrice = get().lastPrice;
            if (finalPrice > 0) {
                get().addRealtimeTick(finalPrice);
            }
        }, 30); // ⚡ 30ms 초고속 스로틀링 배치 업데이트
    };

    const connectWebSocket = (wsUrl: string) => {
        // ⚡ 기존에 예약된 재접속 타이머가 있다면 확실하게 제거하여 중복 실행 방지
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (ws) {
            ws.onopen = null;
            ws.onclose = null;
            ws.onmessage = null;
            ws.close();
        }

        console.log(`[거래소 웹소켓] 스트림 연결 중: ${wsUrl}`);
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            set({ wsConnected: true });
            console.log('[거래소 웹소켓] 연결 성공.');

            // ⚡ 연결 성공했으므로 재접속 타이머 확실하게 해제
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            // PING-PONG 계측 주기 루프
            if (pingTimer) clearInterval(pingTimer);
            pingTimer = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: 'PING', timestamp: Date.now() }));
                }
            }, 2000);

            // TPS 처리량 측정 루프
            if (tpsTimer) clearInterval(tpsTimer);
            tpsTimer = setInterval(() => {
                set({ throughput: msgCount });
                msgCount = 0;
            }, 1000);

            // ⚡ 스로틀 배치 업데이트 주기 구동
            startUpdateLoop();
        };

        ws.onclose = () => {
            set({ wsConnected: false });
            console.log('[거래소 웹소켓] 단절됨. 3초 후 재연결 시도...');
            if (pingTimer) clearInterval(pingTimer);
            if (tpsTimer) clearInterval(tpsTimer);
            if (updateTimer) clearInterval(updateTimer);

            // ⚡ 기존에 생성된 타이머를 지우고 단 하나의 재접속 타이머만 새로 예약
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
                const currentWsUrl = get().wsUrl;
                if (currentWsUrl) connectWebSocket(currentWsUrl);
            }, 3000);
        };

        ws.onmessage = (event) => {
            msgCount++;
            const data = event.data;

            // ⚡ 디버깅용 수신 상태 로그 비활성화
            // console.log(`[WS 수신] 데이터 타입: ${typeof data}, 크기: ${data instanceof ArrayBuffer ? data.byteLength : 'N/A'}`);

            if (typeof data === 'string') {
                // console.log("[WS 수신 문자열 내용]:", data);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.action === 'PONG') {
                        const rtt = Date.now() - parsed.timestamp;
                        set({ latency: rtt });
                    } else if (parsed.action === 'REJECT') {
                        console.warn("[WS REJECT] 주문이 거절되었습니다:", parsed);
                        set({
                            lastRejectEvent: {
                                symbol: parsed.symbol,
                                side: parsed.side,
                                price: Number(parsed.price),
                                qty: Number(parsed.qty),
                                reason: parsed.reason,
                                timestamp: Date.now()
                            }
                        });
                    }
                } catch (e) { }
                return;
            }

            const buffer: ArrayBuffer = data;
            if (buffer.byteLength !== 32) {
                console.warn(`[WS 에러] 데이터 바이너리 크기 불일치: ${buffer.byteLength} (기대값: 32)`);
                return;
            }

            const view = new DataView(buffer);
            // ⚡ 32바이트 바이너리 패킷 사양 상세 레이아웃 (Big-Endian):
            // - Offset [00 ~ 03] (4 bytes, Int32): Symbol ID (예: "BTC-USD"의 해시코드)
            // - Offset [12 ~ 19] (8 bytes, BigInt64): 가격 (Price, 원본 정수 형태)
            // - Offset [20 ~ 27] (8 bytes, BigInt64): 수량 변화량 (Delta Qty)
            // - Offset [28 ~ 31] (4 bytes, Int32): 주문 방향 (Side: 0 = Bid/BUY, 1 = Ask/SELL)
            const symbolId = view.getInt32(0, false);
            const price = view.getBigInt64(12, false);
            const deltaQty = view.getBigInt64(20, false);
            const side = view.getInt32(28, false);

            const priceNum = Number(price);
            const qtyNum = Number(deltaQty);

            // 심볼 해시코드를 기반으로 활성화된 마켓 목록 중에서 동적 타겟 심볼 검색
            let msgSymbol = '';
            const activeMarkets = get().markets;
            for (const m of activeMarkets) {
                if (getHashCode(m.symbol) === symbolId) {
                    msgSymbol = m.symbol;
                    break;
                }
            }

            // 마켓 목록 로드 전이거나 매칭되는 심볼을 찾지 못한 경우 하드코딩 폴백 지원
            if (!msgSymbol) {
                if (symbolId === BTC_SYMBOL_ID) msgSymbol = 'BTC-USD';
                else if (symbolId === ADA_SYMBOL_ID) msgSymbol = 'ADA-KRW';
                else if (symbolId === getHashCode('JAF-KRW')) msgSymbol = 'JAF-KRW';
                else if (symbolId === getHashCode('JAF-USD')) msgSymbol = 'JAF-USD';
                else {
                    return; // 알 수 없는 마켓 데이터 무시
                }
            }

            const currentSymbol = get().activeSymbol;

            // 1. 호가창 잔량 반영 (증가/감소 모두 적용)
            if (msgSymbol === currentSymbol) {
                const targetMap = side === 0 ? bidsMap : asksMap;
                const currentQty = targetMap.get(priceNum) || 0;
                const nextQty = currentQty + qtyNum;

                if (nextQty <= 0) {
                    targetMap.delete(priceNum);
                } else {
                    targetMap.set(priceNum, nextQty);
                }
                orderbookChanged = true; // ⚡ 변경사항 기록
            }

            // 2. 음수 잔량일 경우 매칭(체결) 발생에 해당하므로 체결 내역에도 적재
            if (qtyNum < 0) {
                const scale = get().getScaleFactor(msgSymbol);
                // 실시간 체결가 및 수량에 스케일 팩터를 적용하여 실제 소수점 값으로 변환
                const actualQty = Math.abs(qtyNum) / scale;
                const actualPrice = priceNum / scale;

                // ⚡ 임시 버퍼에 누적 (즉시 리렌더링 방지)
                recentTradesBuffer.push({
                    tradeId: Date.now().toString().substring(7) + Math.floor(Math.random() * 10),
                    symbol: msgSymbol,
                    side: side === 0 ? 'BUY' : 'SELL',
                    price: actualPrice,
                    qty: actualQty,
                    executedAt: new Date().toISOString()
                });

                if (msgSymbol === currentSymbol) {
                    recentTradesPower.push({ side, qty: actualQty, time: Date.now() });
                }
            }
        };
    };

    return {
        apiBaseUrl: 'http://localhost:8181',
        wsUrl: 'ws://localhost:8088/ws',
        activeSymbol: 'BTC-USD',
        activeResolution: '1m',
        wsConnected: false,
        lastPrice: 0,
        totalTradesCount: 0,
        totalVolumeText: '-',
        tradesLog: [],
        loadedCandles: [],
        tickerPrices: {},
        lastRejectEvent: null,
        clearRejectEvent: () => set({ lastRejectEvent: null }),

        bids: [],
        asks: [],
        midPrice: 0,
        spread: 0,
        volumePower: 100.0,
        latency: 0,
        throughput: 0,
        getScaleFactor: (symbol?: string) => {
            const activeSym = symbol || get().activeSymbol;
            const m = get().markets.find((x: any) => x.symbol === activeSym);
            const decimals = m ? m.priceDecimals : 2; // 마켓 테이블에서 price_decimals를 직접 읽어옴
            return Math.pow(10, decimals);
        },
        // 마켓의 현재 가격대에 해당하는 호가 단위(Tick Size)를 구함
        getTickSize: (symbol: string, humanPrice: number): number => {
            const m = get().markets.find((x: any) => x.symbol === symbol);
            // 호가 정책이 없으면 소수점 자릿수 기준 기본 단위를 사용함
            if (!m || !m.tickSizeLevels || m.tickSizeLevels.length === 0) {
                const decimals = m ? m.priceDecimals : 2;
                return Math.pow(10, -decimals);
            }
            let matchedTickSize = null;
            // 각 구간별 호가 크기를 탐색함
            for (const level of m.tickSizeLevels) {
                if (humanPrice >= level.priceAbove) {
                    matchedTickSize = level.tickSize;
                } else {
                    break;
                }
            }
            if (matchedTickSize === null) {
                matchedTickSize = m.tickSizeLevels[0].tickSize;
            }
            return matchedTickSize;
        },

        // 인증 상태 초기화 값 설정
        isAuthenticated: !!getLocalAccessToken(),
        authEmail: localStorage.getItem('user_auth_email') || null,
        authUserId: localStorage.getItem('user_auth_id') ? parseInt(localStorage.getItem('user_auth_id')!) : null,
        isLoginModalOpen: false,
        setLoginModalOpen: (open) => set({ isLoginModalOpen: open }),

        // 로그인 액션 구현
        login: async (email, password) => {
            try {
                const res = await fetch(`${get().apiBaseUrl}/admin/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (res.ok) {
                    const rawJson = await res.json();
                    const tokens = rawJson.data !== undefined ? rawJson.data : rawJson;
                    setLocalTokens(tokens.accessToken, tokens.refreshToken);

                    let userId = 1;
                    try {
                        const base64Url = tokens.accessToken.split('.')[1];
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                        const payload = JSON.parse(window.atob(base64));
                        if (payload.userId) {
                            userId = Number(payload.userId);
                        }
                    } catch (err) {
                        console.error("[Auth] JWT 디코딩 에러", err);
                    }

                    localStorage.setItem('user_auth_email', tokens.email);
                    localStorage.setItem('user_auth_id', userId.toString());

                    set({
                        isAuthenticated: true,
                        authEmail: tokens.email,
                        authUserId: userId,
                        isLoginModalOpen: false
                    });
                    console.log("[Auth] 사용자 로그인 성공. ID:", userId);
                    return { success: true };
                } else {
                    const errData = await res.json();
                    return { success: false, message: errData.message || "로그인 실패" };
                }
            } catch (err) {
                console.error("[Auth] 로그인 처리 실패", err);
                return { success: false, message: "서버에 연결할 수 없습니다." };
            }
        },

        // 신규 회원가입 신청 처리를 수행함
        signup: async (email, password) => {
            try {
                const res = await fetch(`${get().apiBaseUrl}/admin/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (res.ok) {
                    return { success: true };
                } else {
                    const errData = await res.json();
                    return { success: false, message: errData.message || "회원가입 실패" };
                }
            } catch (err) {
                console.error("[Auth] 회원가입 처리 실패", err);
                return { success: false, message: "서버에 연결할 수 없습니다." };
            }
        },

        // 로그아웃 액션 구현
        logout: async () => {
            try {
                const email = get().authEmail;
                if (email) {
                    await fetch(`${get().apiBaseUrl}/admin/auth/logout`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                }
            } catch (err) {
                console.error("[Auth] 로그아웃 전송 실패", err);
            }
            setLocalTokens(null, null);
            localStorage.removeItem('user_auth_email');
            localStorage.removeItem('user_auth_id');
            set({ isAuthenticated: false, authEmail: null, authUserId: null });
            console.log("[Auth] 로그아웃 성공. 세션 데이터 파괴.");
            window.location.reload();
        },

        // 개인 지갑 잔고 조회 연동
        fetchUserBalances: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/wallets/me`);
                if (res.ok) {
                    const json = await res.json();
                    const data = json.data || json;
                    const balMap: Record<string, number> = {};
                    data.forEach((w: any) => {
                        balMap[w.currency] = parseFloat(w.balance);
                    });
                    return balMap;
                }
            } catch (err) {
                console.error("Failed to fetch user balances", err);
            }
            return {};
        },

        // 개인 체결 거래 이력 연동
        fetchUserTrades: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/me/trades?page=0&size=50`);
                if (res.ok) {
                    const json = await res.json();
                    const data = json.data || json;
                    return data.content || data || [];
                }
            } catch (err) {
                console.error("Failed to fetch user trades", err);
            }
            return [];
        },

        // 개인 원장 변동(입출금) 이력 연동
        fetchUserLedgers: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/me/ledgers?page=0&size=50`);
                if (res.ok) {
                    const json = await res.json();
                    const data = json.data || json;
                    return data.content || data || [];
                }
            } catch (err) {
                console.error("Failed to fetch user ledgers", err);
            }
            return [];
        },

        initStore: async () => {
            let apiHost = window.location.hostname || '127.0.0.1';
            if (apiHost === 'localhost') apiHost = '127.0.0.1';
            let base = `http://${apiHost}:8181`;
            let wsUrl = `ws://${apiHost}:8088/ws`;

            try {
                // config.json 동적 연동
                const res = await fetch('/config.json');
                if (res.ok) {
                    const config = await res.json();
                    if (config.API_BASE_URL) {
                        const configBase = config.API_BASE_URL;
                        const configHost = configBase.replace(/^https?:\/\//, '').split(':')[0];

                        // config.json에 완전히 다른 원격 IP가 명시되어 있는 경우에만 이를 따르고,
                        // 기본 로컬 환경일 경우 접속 주소 브라우저 IP(127.0.0.1/localhost 등)를 신뢰하여 바인딩
                        if (configHost !== 'localhost' && configHost !== '127.0.0.1') {
                            base = configBase;
                            wsUrl = `ws://${configHost}:8088/ws`;
                        }
                    }
                }
            } catch (err) {
                console.log('[환경 구성] config.json 로드 에러로 기본 호스트 자동 보정을 사용합니다.');
            }

            set({ apiBaseUrl: base, wsUrl });
            // 불필요한 콘솔 출력을 억제하여 로깅 오버헤드를 완화함.
            // console.log(`[환경 구성 적용] API: ${base}, WS: ${wsUrl}`);

            // 최초 활성 심볼 스냅샷 적재
            await get().fetchFullSnapshot(get().activeSymbol);

            // ⚡ 이미 웹소켓이 연결 중이거나 연결된 상태이면 중복 연결 실행을 차단
            if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
                console.log('[거래소 웹소켓] 이미 연결되어 있거나 연결 중입니다. 중복 연결 생략.');
                return;
            }

            // 웹소켓 자동 접속 트리거
            connectWebSocket(wsUrl);
        },

        setActiveSymbol: (symbol) => {
            bidsMap.clear();
            asksMap.clear();
            recentTradesPower = [];
            set({ activeSymbol: symbol, lastPrice: 0, bids: [], asks: [], midPrice: 0, spread: 0 });
            get().fetchFullSnapshot(symbol);
        },

        setActiveResolution: (res) => {
            set({ activeResolution: res });
        },

        setWsConnected: (connected) => set({ wsConnected: connected }),

        updateTradeStats: (price, qty, side, symbol) => {
            // 외부(API 등) 호출용 폴백 메서드
            const currentSymbol = get().activeSymbol;
            const newLog: TradeLog = {
                tradeId: Date.now().toString().substring(7) + Math.floor(Math.random() * 10),
                symbol,
                side,
                price,
                qty,
                executedAt: new Date().toISOString()
            };

            set((state) => {
                const nextLogs = [newLog, ...state.tradesLog].slice(0, 50);
                const nextTradesCount = state.totalTradesCount + 1;
                const isMatching = symbol === currentSymbol;

                return {
                    tradesLog: nextLogs,
                    totalTradesCount: nextTradesCount,
                    lastPrice: isMatching ? price : state.lastPrice
                };
            });

            if (symbol === currentSymbol) {
                get().addRealtimeTick(price);
            }
        },

        addLoadedCandles: (candles) => {
            set({ loadedCandles: candles });
        },

        addRealtimeTick: (_price) => {
            // 차트 캔들 실시간 갱신 트리거
        },

        // ⚡ 풀 오더북 스냅샷 연동 (스토어 내부화)
        fetchFullSnapshot: async (symbol) => {
            const port = symbol === 'BTC-USD' ? 9100 : 9101;
            const rawHost = window.location.hostname || '127.0.0.1';
            const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
            const url = `http://${host}:${port}/snapshot`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                bidsMap.clear();
                asksMap.clear();

                if (data.bids) {
                    data.bids.forEach(([price, qty]: [number, number]) => {
                        bidsMap.set(price, qty);
                    });
                }
                if (data.asks) {
                    data.asks.forEach(([price, qty]: [number, number]) => {
                        asksMap.set(price, qty);
                    });
                }

                // 즉각 1차 화면 갱신
                const bidsArr = Array.from(bidsMap.entries())
                    .sort((a, b) => b[0] - a[0])
                    .slice(0, 10);
                const asksArr = Array.from(asksMap.entries())
                    .sort((a, b) => a[0] - b[0])
                    .slice(0, 10);

                const scale = get().getScaleFactor(symbol);
                let mid = 0;
                let diff = 0;
                if (bidsArr.length > 0 && asksArr.length > 0) {
                    const topBid = bidsArr[0][0] / scale;
                    const topAsk = asksArr[0][0] / scale;
                    mid = (topBid + topAsk) / 2.0;
                    diff = topAsk - topBid;
                }

                set({
                    bids: bidsArr,
                    asks: [...asksArr].reverse(),
                    midPrice: mid,
                    spread: diff
                });
            } catch (err: any) {
                console.error(`[스냅샷] 동기화 실패: ${err.message}`);
            }
        },

        // ⚡ 주문 발송 액션
        sendOrder: (payload) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
                return true;
            }
            return false;
        },

        markets: [],
        fetchMarkets: async () => {
            try {
                const res = await fetch(`${get().apiBaseUrl}/admin/stats/markets`);
                if (res.ok) {
                    const json = await res.json();
                    let data = json.data || json;
                    if (data && data.content) { data = data.content; }
                    if (!Array.isArray(data)) { data = []; }
                    set({ markets: data });

                    if (data.length > 0) {
                        const prices: Record<string, { lastPrice: number; prevClosePrice: number }> = { ...get().tickerPrices };
                        try {
                            const tickersRes = await fetch(`${get().apiBaseUrl}/admin/stats/tickers`);
                            if (tickersRes.ok) {
                                const tickersJson = await tickersRes.json();
                                let tickersData = tickersJson.data || tickersJson;
                                if (tickersData && tickersData.content) { tickersData = tickersData.content; }
                                if (Array.isArray(tickersData)) {
                                    tickersData.forEach((t: any) => {
                                        const scale = get().getScaleFactor(t.symbol);
                                        prices[t.symbol] = {
                                            lastPrice: t.lastPrice / scale,
                                            prevClosePrice: t.prevClosePrice / scale
                                        };
                                    });
                                }
                            }
                        } catch (e) {
                            console.error("Failed to fetch tickers", e);
                        }
                        set({ tickerPrices: prices });
                    }
                }
            } catch (err) {
                console.error("Failed to fetch markets", err);
            }
        }
    };
});
