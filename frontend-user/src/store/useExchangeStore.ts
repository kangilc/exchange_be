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

// 동적으로 API 토큰을 가산하고 만료 시 자동 토큰 회전(RTR)을 수행하는 안전한 fetch 래퍼 함수임
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
            // URL의 API 호스트 부분을 유동적으로 적용하기 위해 useExchangeStore 상태를 참조할 수 있도록 base URL 추출
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
                window.location.reload(); // 강제 화면 새로고침하여 로그인 화면 유도
            }
        } catch (e) {
            console.error("[Auth] 토큰 갱신 에러", e);
        }
    }
    return res;
};

// 유저 거래소 중앙 상태 인터페이스
interface ExchangeState {
    apiBaseUrl: string;
    wsUrl: string;
    activeSymbol: string;
    activeResolution: string;
    wsConnected: boolean;
    lastPrice: number;
    totalTradesCount: number;
    totalVolumeText: string;
    tradesLog: TradeLog[];
    loadedCandles: CandleData[];

    // ⚡ 고성능 배치 렌더링용 추가 상태
    bids: [number, number][];
    asks: [number, number][];
    midPrice: number;
    spread: number;
    volumePower: number;
    latency: number;
    throughput: number;

    // 인증 관련 상태 및 액션
    isAuthenticated: boolean;
    authEmail: string | null;
    authUserId: number | null;
    isLoginModalOpen: boolean;
    setLoginModalOpen: (open: boolean) => void;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;

    // 개인화 데이터 API 액션
    fetchUserBalances: () => Promise<Record<string, number>>;
    fetchUserTrades: () => Promise<any[]>;
    fetchUserLedgers: () => Promise<any[]>;

    // 액션 메서드 선언
    initStore: () => Promise<void>;
    setActiveSymbol: (symbol: string) => void;
    setActiveResolution: (res: string) => void;
    setWsConnected: (connected: boolean) => void;
    updateTradeStats: (price: number, qty: number, side: 'BUY' | 'SELL', symbol: string) => void;
    addLoadedCandles: (candles: CandleData[]) => void;
    addRealtimeTick: (price: number) => void;

    // ⚡ 고성능 모듈용 전역 액션
    fetchFullSnapshot: (symbol: string) => Promise<void>;
    sendOrder: (payload: any) => boolean;
    markets: any[];
    fetchMarkets: () => Promise<void>;
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

            let mid = 0;
            let diff = 0;
            if (bidsArr.length > 0 && asksArr.length > 0) {
                const topBid = bidsArr[0][0] / 100.0;
                const topAsk = asksArr[0][0] / 100.0;
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
                if (hasNewTrades) {
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
                    lastPrice: nextLastPrice
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
                    }
                } catch (e) {}
                return;
            }

            const buffer: ArrayBuffer = data;
            if (buffer.byteLength !== 32) {
                console.warn(`[WS 에러] 데이터 바이너리 크기 불일치: ${buffer.byteLength} (기대값: 32)`);
                return;
            }

            const view = new DataView(buffer);
            const symbolId = view.getInt32(0, false);
            const price = view.getBigInt64(12, false);
            const deltaQty = view.getBigInt64(20, false);
            const side = view.getInt32(28, false);

            const priceNum = Number(price);
            const qtyNum = Number(deltaQty);

            let msgSymbol = '';
            if (symbolId === BTC_SYMBOL_ID) msgSymbol = 'BTC-USD';
            else if (symbolId === ADA_SYMBOL_ID) msgSymbol = 'ADA-KRW';
            else {
                console.warn(`[WS 에러] 일치하지 않는 심볼 ID 수신: ${symbolId} (BTC 기대값: ${BTC_SYMBOL_ID}, ADA 기대값: ${ADA_SYMBOL_ID})`);
                return;
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
                const actualQty = Math.abs(qtyNum);
                const actualPrice = priceNum / 100.0;

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

        bids: [],
        asks: [],
        midPrice: 0,
        spread: 0,
        volumePower: 100.0,
        latency: 0,
        throughput: 0,

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
                    const tokens = await res.json();
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
                    const data = await res.json();
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
                    const data = await res.json();
                    return data.content || [];
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
                    const data = await res.json();
                    return data.content || [];
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
            console.log(`[환경 구성 적용] API: ${base}, WS: ${wsUrl}`);

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

                let mid = 0;
                let diff = 0;
                if (bidsArr.length > 0 && asksArr.length > 0) {
                    const topBid = bidsArr[0][0] / 100.0;
                    const topAsk = asksArr[0][0] / 100.0;
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
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/stats/markets`);
                if (res.ok) {
                    const data = await res.json();
                    set({ markets: data || [] });
                }
            } catch (err) {
                console.error("Failed to fetch markets", err);
            }
        }
    };
});
