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

// 로컬 스토리지 내 JWT 토큰 관리 헬퍼
const getLocalAccessToken = () => localStorage.getItem('admin_access_token');
const getLocalRefreshToken = () => localStorage.getItem('admin_refresh_token');
const setLocalTokens = (access: string | null, refresh: string | null) => {
    if (access) localStorage.setItem('admin_access_token', access);
    else localStorage.removeItem('admin_access_token');
    if (refresh) localStorage.setItem('admin_refresh_token', refresh);
    else localStorage.removeItem('admin_refresh_token');
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
            const refreshRes = await fetch('http://localhost:8181/admin/auth/refresh', {
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
                localStorage.removeItem('admin_auth_email');
                window.location.reload(); // 강제 화면 새로고침하여 로그인 화면 유도
            }
        } catch (e) {
            console.error("[Auth] 토큰 갱신 에러", e);
        }
    }
    return res;
};

// 어드민 중앙 상태 인터페이스
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
    users: any[];
    wallets: any[];
    walletsSummary: any[];
    ledgerList: any[];
    ledgerTotalCount: number;
    ledgerTotalPages: number;

    // 인증 관련 신규 상태 및 액션
    isAuthenticated: boolean;
    authEmail: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;

    // 액션 메서드 선언
    initStore: () => Promise<void>;
    setActiveSymbol: (symbol: string) => void;
    setActiveResolution: (res: string) => void;
    setWsConnected: (connected: boolean) => void;
    updateTradeStats: (price: number, qty: number, side: 'BUY' | 'SELL', symbol: string) => void;
    addLoadedCandles: (candles: CandleData[]) => void;
    addRealtimeTick: (price: number) => void;

    // ⚡ 고성능 배치 렌더링용 추가 상태
    bids: [number, number][];
    asks: [number, number][];
    midPrice: number;
    spread: number;
    volumePower: number;
    latency: number;
    throughput: number;

    fetchFullSnapshot: (symbol: string) => Promise<void>;
    sendOrder: (payload: any) => boolean;

    // 어드민 전용 추가 메서드
    fetchUsers: () => Promise<void>;
    registerUser: (email: string, password: string, grade: string) => Promise<boolean>;
    updateUser: (userId: number, email: string, grade: string, status: string) => Promise<boolean>;
    fetchWallets: () => Promise<void>;
    fetchWalletsSummary: () => Promise<void>;
    adjustUserAsset: (userId: number, currency: string, amount: number) => Promise<boolean>;
    fetchLedgerList: (page: number, size: number, email?: string) => Promise<void>;
    fetchUserLedgers: (userId: number, page?: number, size?: number) => Promise<any>;
    fetchUserTrades: (userId: number, page?: number, size?: number) => Promise<any>;
    fetchSummaryStats: () => Promise<void>;
}

// 심볼 해시코드 상수
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

export const useExchangeStore = create<ExchangeState>((set, get) => {
    let ws: WebSocket | null = null;

    // ⚡ 고성능 인메모리 버퍼 변수 (Zustand 렌더 루프 격리)
    const bidsMap = new Map<number, number>();
    const asksMap = new Map<number, number>();
    let recentTradesBuffer: TradeLog[] = [];
    let recentTradesPower: { side: number; qty: number; time: number }[] = [];
    let msgCount = 0;
    let updateTimer: any = null;
    let tpsTimer: any = null;
    let pingTimer: any = null;

    const startUpdateLoop = () => {
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => {
            const currentSymbol = get().activeSymbol;

            // 1. 체결강도 갱신 (최근 30초 필터)
            const now = Date.now();
            recentTradesPower = recentTradesPower.filter(t => now - t.time < 30000);

            let buySum = 0;
            let sellSum = 0;
            recentTradesPower.forEach(t => {
                if (t.side === 1) buySum += t.qty;
                else sellSum += t.qty;
            });
            const power = sellSum > 0 ? (buySum / sellSum) * 100 : 100;

            // 2. 오더북 가공 (매수/매도 10단 정렬)
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

            // 3. Zustand 스토어 일괄 업데이트 (최대 초당 10회로 렌더링 강제 제한)
            set((state) => {
                let nextLogs = [...state.tradesLog];
                if (recentTradesBuffer.length > 0) {
                    nextLogs = [...recentTradesBuffer.reverse(), ...state.tradesLog].slice(0, 50);
                    recentTradesBuffer = [];
                }

                const matchingLog = nextLogs.find(l => l.symbol === currentSymbol);
                const lastPrice = matchingLog ? matchingLog.price : state.lastPrice;

                return {
                    tradesLog: nextLogs,
                    bids: bidsArr,
                    asks: [...asksArr].reverse(),
                    midPrice: mid,
                    spread: diff,
                    volumePower: power,
                    lastPrice
                };
            });

            // 차트 캔들 실시간 갱신 유도
            const finalPrice = get().lastPrice;
            if (finalPrice > 0) {
                get().addRealtimeTick(finalPrice);
            }
        }, 100); // ⚡ 100ms 초고속 스로틀링 배치 업데이트
    };

    const connectWebSocket = (wsUrl: string) => {
        if (ws) {
            ws.onopen = null;
            ws.onclose = null;
            ws.onmessage = null;
            ws.close();
        }

        console.log(`[어드민 웹소켓] 스트림 연결 중: ${wsUrl}`);
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            set({ wsConnected: true });
            console.log('[어드민 웹소켓] 연결 성공.');

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
            console.log('[어드민 웹소켓] 단절됨. 3초 후 재연결 시도...');
            if (pingTimer) clearInterval(pingTimer);
            if (tpsTimer) clearInterval(tpsTimer);
            if (updateTimer) clearInterval(updateTimer);

            setTimeout(() => {
                const currentWsUrl = get().wsUrl;
                if (currentWsUrl) connectWebSocket(currentWsUrl);
            }, 3000);
        };

        ws.onmessage = (event) => {
            msgCount++;
            const data = event.data;
            if (typeof data === 'string') {
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
            if (buffer.byteLength !== 32) return;

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
            else return;

            const currentSymbol = get().activeSymbol;

            if (qtyNum < 0) {
                const actualQty = Math.abs(qtyNum);
                const actualPrice = priceNum / 100.0;

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
            } else {
                if (msgSymbol === currentSymbol) {
                    const targetMap = side === 0 ? bidsMap : asksMap;
                    const currentQty = targetMap.get(priceNum) || 0;
                    const nextQty = currentQty + qtyNum;

                    if (nextQty <= 0) {
                        targetMap.delete(priceNum);
                    } else {
                        targetMap.set(priceNum, nextQty);
                    }
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
        users: [],
        wallets: [],
        walletsSummary: [],
        ledgerList: [],
        ledgerTotalCount: 0,
        ledgerTotalPages: 0,

        bids: [],
        asks: [],
        midPrice: 0,
        spread: 0,
        volumePower: 100.0,
        latency: 0,
        throughput: 0,

        // 인증 상태 초기화 값 설정
        isAuthenticated: !!getLocalAccessToken(),
        authEmail: localStorage.getItem('admin_auth_email') || null,

        // 어드민 로그인 액션 구현
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
                    localStorage.setItem('admin_auth_email', tokens.email);
                    set({ isAuthenticated: true, authEmail: tokens.email });
                    console.log("[Auth] 로그인 성공. 토큰 수립 완료.");
                    return true;
                }
            } catch (err) {
                console.error("[Auth] 로그인 처리 실패", err);
            }
            return false;
        },

        // 어드민 로그아웃 액션 구현
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
            localStorage.removeItem('admin_auth_email');
            set({ isAuthenticated: false, authEmail: null });
            console.log("[Auth] 로그아웃 성공. 세션 데이터 파괴.");
            window.location.reload();
        },

        initStore: async () => {
            try {
                // 1. config.json 동적 연동
                const res = await fetch('/config.json');
                if (res.ok) {
                    const config = await res.json();
                    if (config.API_BASE_URL) {
                        const base = config.API_BASE_URL;
                        const host = base.replace(/^https?:\/\//, '').split(':')[0];
                        const wsUrl = `ws://${host}:8088/ws`;

                        set({ apiBaseUrl: base, wsUrl });
                        console.log(`[환경 구성] config.json 로드 성공. API: ${base}, WS: ${wsUrl}`);
                    }
                }
            } catch (err) {
                console.log('[환경 구성] config.json이 없으므로 브라우저 기본 로컬 설정을 활성화합니다.');
            }

            // 최초 활성 심볼 스냅샷 적재
            await get().fetchFullSnapshot(get().activeSymbol);

            // 웹소켓 자동 접속 트리거
            const currentWs = get().wsUrl;
            connectWebSocket(currentWs);
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
            // 차트 캔들 실시간 갱신용
        },

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

        sendOrder: (payload) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
                return true;
            }
            return false;
        },

        fetchUsers: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users`);
                if (res.ok) {
                    const data = await res.json();
                    set({ users: data });
                }
            } catch (err) {
                console.error("Failed to fetch users", err);
            }
        },

        registerUser: async (email, password, grade) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, grade })
                });
                return res.ok;
            } catch (err) {
                console.error("Failed to register user", err);
                return false;
            }
        },

        updateUser: async (userId, email, grade, status) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, grade, status })
                });
                return res.ok;
            } catch (err) {
                console.error("Failed to update user", err);
                return false;
            }
        },

        fetchWallets: async () => {
            try {
                // 두 API 요청을 병렬로 동시에 날려 레이턴시를 50% 감축시킵니다. (fetchWithAuth 사용)
                const [walletsRes, usersRes] = await Promise.all([
                    fetchWithAuth(`${get().apiBaseUrl}/admin/wallets`),
                    fetchWithAuth(`${get().apiBaseUrl}/admin/users`)
                ]);

                if (walletsRes.ok && usersRes.ok) {
                    const wallets = await walletsRes.json();
                    const users = await usersRes.json();
                    const userMap = new Map(users.map((u: any) => [u.userId, u.email]));
                    const mappedWallets = wallets.map((w: any) => ({
                        ...w,
                        email: userMap.get(w.userId) || 'Unknown Account'
                    }));
                    set({ wallets: mappedWallets });
                } else if (walletsRes.ok) {
                    const wallets = await walletsRes.json();
                    set({ wallets });
                }
            } catch (err) {
                console.error("Failed to fetch wallets", err);
            }
        },

        fetchWalletsSummary: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/wallets/summary`);
                if (res.ok) {
                    const summary = await res.json();
                    set({ walletsSummary: summary });
                }
            } catch (err) {
                console.error("Failed to fetch wallets summary", err);
            }
        },

        adjustUserAsset: async (userId, currency, amount) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currency, amount })
                });
                return res.ok;
            } catch (err) {
                console.error("Failed to adjust user asset", err);
                return false;
            }
        },

        fetchLedgerList: async (page, size, email) => {
            try {
                const searchParam = email ? `&email=${encodeURIComponent(email)}` : '';
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/ledgers?page=${page}&size=${size}${searchParam}`);
                if (res.ok) {
                    const data = await res.json();
                    set({
                        ledgerList: data.content || [],
                        ledgerTotalCount: data.totalElements || 0,
                        ledgerTotalPages: data.totalPages || 0
                    });
                }
            } catch (err) {
                console.error("Failed to fetch ledger list", err);
            }
        },

        fetchUserLedgers: async (userId, page = 0, size = 10) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}/ledgers?page=${page}&size=${size}`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (err) {
                console.error("Failed to fetch user ledgers", err);
            }
            return { content: [], totalPages: 1, totalElements: 0 };
        },

        fetchUserTrades: async (userId, page = 0, size = 10) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}/trades?page=${page}&size=${size}`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (err) {
                console.error("Failed to fetch user trades", err);
            }
            return { content: [], totalPages: 1, totalElements: 0 };
        },

        fetchSummaryStats: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/stats/summary`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.totalTrades === 'number') {
                        set({ totalTradesCount: data.totalTrades });
                        // console.log(`[통계 동기화] DB 누적 체결 수 동기화 성공: ${data.totalTrades} 건`);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch summary stats", err);
            }
        }
    };
});
