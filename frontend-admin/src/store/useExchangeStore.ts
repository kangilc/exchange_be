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

    bids: [number, number][];
    asks: [number, number][];
    midPrice: number;
    spread: number;
    volumePower: number;
    latency: number;
    throughput: number;
    sendOrder: (payload: any) => boolean;
    fetchFullSnapshot: (symbol: string) => Promise<void>;

    // 인증 관련 상태 및 액션
    isAuthenticated: boolean;
    authEmail: string | null;
    login: (email: string, password: string) => Promise<{ success: boolean; priorLoginExisted?: boolean }>;
    logout: () => void;

    // 액션 메서드 선언
    initStore: () => Promise<void>;
    setActiveSymbol: (symbol: string) => void;
    setActiveResolution: (res: string) => void;
    setWsConnected: (connected: boolean) => void;
    updateTradeStats: (price: number, qty: number, side: 'BUY' | 'SELL', symbol: string) => void;
    addLoadedCandles: (candles: CandleData[]) => void;
    addRealtimeTick: (price: number) => void;

    // 어드민 전용 추가 메서드
    fetchUsers: () => Promise<void>;
    registerUser: (email: string, password: string, grade: string) => Promise<boolean>;
    updateUser: (userId: number, email: string, grade: string, status: string) => Promise<boolean>;
    fetchWallets: () => Promise<void>;
    fetchWalletsSummary: () => Promise<void>;
    adjustUserAsset: (userId: number, currency: string, amount: number) => Promise<boolean>;
    fetchLedgerList: (page: number, size: number, email?: string) => Promise<void>;
    fetchUserLedgers: (userId: number) => Promise<any[]>;
    fetchUserTrades: (userId: number) => Promise<any[]>;
    fetchSummaryStats: () => Promise<void>;
    duplicateLoginBlockEnabled: boolean;
    onChainDepositMonitoringEnabled: boolean;
    walletSimulationEnabled: boolean;
    btcConfirmations: number;
    ethConfirmations: number;
    adaConfirmations: number;
    btcUsdFeeRate: number;
    adaKrwFeeRate: number;
    cryptoWithdrawals: any[];
    hotWallets: any[];
    userCryptoAddresses: any[];
    pendingDeposits: any[];
    blockHeight: number;
    fetchSettings: () => Promise<void>;
    toggleDuplicateLoginBlock: (enabled: boolean) => Promise<void>;
    toggleOnChainDepositMonitoring: (enabled: boolean) => Promise<void>;
    toggleWalletSimulation: (enabled: boolean) => Promise<void>;
    updateConfirmationsSettings: (btc: number, eth: number, ada: number) => Promise<void>;
    updateFeeSettings: (btcUsd: number, adaKrw: number) => Promise<void>;
    fetchPerformanceStats: () => Promise<any>;
    sendWsMessage: (message: any) => boolean;
    fetchCryptoWithdrawals: () => Promise<void>;
    fetchHotWallets: () => Promise<void>;
    fetchUserCryptoAddresses: () => Promise<void>;
    fetchPendingDeposits: () => Promise<void>;
    fetchBlockHeight: () => Promise<void>;
    approveWithdrawal: (id: number) => Promise<boolean>;
    rejectWithdrawal: (id: number) => Promise<boolean>;
    rebalanceHotWallet: (id: number, amount: number) => Promise<boolean>;
    requestCryptoWithdrawal: (userId: number, currency: string, amount: number, toAddress: string) => Promise<boolean>;
}

// 심볼 해시코드 상수
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

export const useExchangeStore = create<ExchangeState>((set, get) => {
    let ws: WebSocket | null = null;
    let pingTimer: any = null;
    let tpsTimer: any = null;
    let updateTimer: any = null;

    // ⚡ 버퍼 데이터 스토리지 및 최적화 상태 플래그
    const bidsMap = new Map<number, number>();
    const asksMap = new Map<number, number>();
    let recentTradesBuffer: TradeLog[] = [];
    let recentTradesPower: { side: number; qty: number; time: number }[] = [];
    let msgCount = 0;
    let isDirty = false; // ⚡ 실시간 수신 데이터 변경 유무 플래그

    // ⚡ 실시간 UI 상태 일괄 동기화 (100ms 스로틀)
    const startUpdateLoop = () => {
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => {
            if (!isDirty) return; // ⚡ 변경사항이 없으면 리렌더링 및 무의미 연산 스킵!

            const currentSymbol = get().activeSymbol;

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

            // 3. 체결 내역 업데이트 및 상태 반영
            let logsChanged = false;
            set((state) => {
                let nextLogs = state.tradesLog; // ⚡ 변경 없을 시 얕은복사를 통한 불필요 참조 갱신 방지
                if (recentTradesBuffer.length > 0) {
                    nextLogs = [...recentTradesBuffer, ...nextLogs].slice(0, 50);
                    recentTradesBuffer = [];
                    logsChanged = true;
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

                if (logsChanged) {
                    nextState.tradesLog = nextLogs;
                }

                return nextState;
            });

            isDirty = false; // ⚡ 플래그 초기화
        }, 100);
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

            pingTimer = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: 'PING', timestamp: Date.now() }));
                }
            }, 2000);

            tpsTimer = setInterval(() => {
                set({ throughput: msgCount });
                msgCount = 0;
            }, 1000);

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
                isDirty = true; // ⚡ 변경사항 기록
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
                    isDirty = true; // ⚡ 변경사항 기록
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
        users: [],
        wallets: [],
        walletsSummary: [],
        ledgerList: [],
        ledgerTotalCount: 0,
        ledgerTotalPages: 0,
        duplicateLoginBlockEnabled: true,
        onChainDepositMonitoringEnabled: true,
        walletSimulationEnabled: true,
        btcConfirmations: 3,
        ethConfirmations: 12,
        adaConfirmations: 5,
        btcUsdFeeRate: 0.001,
        adaKrwFeeRate: 0.0005,
        cryptoWithdrawals: [],
        hotWallets: [],
        userCryptoAddresses: [],
        pendingDeposits: [],
        blockHeight: 0,

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
                    return { success: true, priorLoginExisted: tokens.priorLoginExisted };
                }
            } catch (err) {
                console.error("[Auth] 로그인 처리 실패", err);
            }
            return { success: false };
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
            let apiHost = window.location.hostname || '127.0.0.1';
            if (apiHost === 'localhost') apiHost = '127.0.0.1';
            let base = `http://${apiHost}:8181`;
            let wsUrl = `ws://${apiHost}:8088/ws`;

            try {
                // 1. config.json 동적 연동
                const res = await fetch('/config.json');
                if (res.ok) {
                    const config = await res.json();
                    if (config.API_BASE_URL) {
                        const configBase = config.API_BASE_URL;
                        const configHost = configBase.replace(/^https?:\/\//, '').split(':')[0];
                        
                        // 현재 브라우저 주소창의 호스트가 localhost 혹은 127.0.0.1일 때만 config.json 신뢰
                        // 그렇지 않을 때는 브라우저 접속 IP를 사용하여 자동 라우팅 보정
                        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                            base = configBase;
                            wsUrl = `ws://${configHost}:8088/ws`;
                        }
                    }
                }
            } catch (err) {
                console.log('[환경 구성] config.json이 없으므로 브라우저 기본 로컬 설정을 활성화합니다.');
            }

            set({ apiBaseUrl: base, wsUrl });
            console.log(`[환경 구성 적용] API: ${base}, WS: ${wsUrl}`);

            // 최초 활성 심볼 스냅샷 적재
            await get().fetchFullSnapshot(get().activeSymbol);

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

        setActiveResolution: (res) => {
            set({ activeResolution: res });
            // console.log(`[해상도 전환] ${res} 활성화 완료.`);
        },

        setWsConnected: (connected) => set({ wsConnected: connected }),

        updateTradeStats: (price, qty, side, symbol) => {
            const currentSymbol = get().activeSymbol;

            // 실시간 체결 로그 데이터 주입
            const newLog: TradeLog = {
                tradeId: Date.now().toString().substring(7) + Math.floor(Math.random() * 10),
                symbol,
                side,
                price,
                qty,
                executedAt: new Date().toISOString()
            };

            set((state) => {
                const nextLogs = [newLog, ...state.tradesLog].slice(0, 50); // 최대 50건 유지
                const nextTradesCount = state.totalTradesCount + 1;

                // 현재 활성화된 마켓 정보와 매칭되는 틱 정보만 전역 수치에 반영
                const isMatching = symbol === currentSymbol;

                return {
                    tradesLog: nextLogs,
                    totalTradesCount: nextTradesCount,
                    lastPrice: isMatching ? price : state.lastPrice
                };
            });

            // 실시간 틱 차트 반영
            if (symbol === currentSymbol) {
                get().addRealtimeTick(price);
            }
        },

        addLoadedCandles: (candles) => {
            set({ loadedCandles: candles });
        },

        addRealtimeTick: (_price) => {
            // 차트 캔들 실시간 갱신용 로직을 마운트하기 위해 Hook 및 컴포넌트 레벨에서 차트 시리즈 레퍼런스 업데이트 수행 유도
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
                // 두 API 요청을 병렬로 동시에 날려 레이턴시를 50% 감축시킵니다.
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

        fetchUserLedgers: async (userId) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}/ledgers?page=0&size=50`);
                if (res.ok) {
                    const data = await res.json();
                    return data.content || [];
                }
            } catch (err) {
                console.error("Failed to fetch user ledgers", err);
            }
            return [];
        },

        fetchUserTrades: async (userId) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/users/${userId}/trades?page=0&size=50`);
                if (res.ok) {
                    const data = await res.json();
                    return data.content || [];
                }
            } catch (err) {
                console.error("Failed to fetch user trades", err);
            }
            return [];
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
        },

        fetchSettings: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`);
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        set({
                            duplicateLoginBlockEnabled: !!data.duplicateLoginBlockEnabled,
                            onChainDepositMonitoringEnabled: !!data.onChainDepositMonitoringEnabled,
                            walletSimulationEnabled: !!data.walletSimulationEnabled,
                            btcConfirmations: typeof data.btcConfirmations === 'number' ? data.btcConfirmations : 3,
                            ethConfirmations: typeof data.ethConfirmations === 'number' ? data.ethConfirmations : 12,
                            adaConfirmations: typeof data.adaConfirmations === 'number' ? data.adaConfirmations : 5,
                            btcUsdFeeRate: typeof data.btcUsdFeeRate === 'number' ? data.btcUsdFeeRate : 0.001,
                            adaKrwFeeRate: typeof data.adaKrwFeeRate === 'number' ? data.adaKrwFeeRate : 0.0005
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to fetch settings", err);
            }
        },

        updateFeeSettings: async (btcUsd: number, adaKrw: number) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        btcUsdFeeRate: btcUsd,
                        adaKrwFeeRate: adaKrw
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        set({
                            btcUsdFeeRate: typeof data.btcUsdFeeRate === 'number' ? data.btcUsdFeeRate : btcUsd,
                            adaKrwFeeRate: typeof data.adaKrwFeeRate === 'number' ? data.adaKrwFeeRate : adaKrw
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to update fee settings", err);
            }
        },

        fetchPerformanceStats: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/stats/performance`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (err) {
                console.error("Failed to fetch performance stats", err);
            }
            return null;
        },

        toggleDuplicateLoginBlock: async (enabled: boolean) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duplicateLoginBlockEnabled: enabled })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.duplicateLoginBlockEnabled === 'boolean') {
                        set({ duplicateLoginBlockEnabled: data.duplicateLoginBlockEnabled });
                        console.log(`[설정 변경] 중복 로그인 차단 상태가 ${enabled}로 변경되었습니다.`);
                    }
                }
            } catch (err) {
                console.error("Failed to toggle duplicate login block", err);
            }
        },

        toggleOnChainDepositMonitoring: async (enabled: boolean) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ onChainDepositMonitoringEnabled: enabled })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.onChainDepositMonitoringEnabled === 'boolean') {
                        set({ onChainDepositMonitoringEnabled: data.onChainDepositMonitoringEnabled });
                        console.log(`[설정 변경] 실시간 온체인 입금 모니터링 상태가 ${enabled}로 변경되었습니다.`);
                    }
                }
            } catch (err) {
                console.error("Failed to toggle on-chain deposit monitoring", err);
            }
        },

        toggleWalletSimulation: async (enabled: boolean) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletSimulationEnabled: enabled })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.walletSimulationEnabled === 'boolean') {
                        set({ walletSimulationEnabled: data.walletSimulationEnabled });
                        console.log(`[설정 변경] 지갑 시뮬레이션 상태가 ${enabled}로 변경되었습니다.`);
                    }
                }
            } catch (err) {
                console.error("Failed to toggle wallet simulation", err);
            }
        },

        updateConfirmationsSettings: async (btc: number, eth: number, ada: number) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        btcConfirmations: btc,
                        ethConfirmations: eth,
                        adaConfirmations: ada
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        set({
                            btcConfirmations: typeof data.btcConfirmations === 'number' ? data.btcConfirmations : btc,
                            ethConfirmations: typeof data.ethConfirmations === 'number' ? data.ethConfirmations : eth,
                            adaConfirmations: typeof data.adaConfirmations === 'number' ? data.adaConfirmations : ada
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to update confirmations settings", err);
            }
        },

        sendWsMessage: (message: any) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
                return true;
            }
            return false;
        },

        fetchCryptoWithdrawals: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/withdrawals`);
                if (res.ok) {
                    const data = await res.json();
                    set({ cryptoWithdrawals: data });
                }
            } catch (err) {
                console.error("Failed to fetch crypto withdrawals", err);
            }
        },

        fetchHotWallets: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/hot-wallets`);
                if (res.ok) {
                    const data = await res.json();
                    set({ hotWallets: data });
                }
            } catch (err) {
                console.error("Failed to fetch hot wallets", err);
            }
        },

        fetchUserCryptoAddresses: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/addresses`);
                if (res.ok) {
                    const data = await res.json();
                    set({ userCryptoAddresses: data });
                }
            } catch (err) {
                console.error("Failed to fetch user crypto addresses", err);
            }
        },

        fetchPendingDeposits: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/pending-deposits`);
                if (res.ok) {
                    const data = await res.json();
                    set({ pendingDeposits: data });
                }
            } catch (err) {
                console.error("Failed to fetch pending deposits", err);
            }
        },

        fetchBlockHeight: async () => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/block-height`);
                if (res.ok) {
                    const data = await res.json();
                    set({ blockHeight: data.blockHeight });
                }
            } catch (err) {
                console.error("Failed to fetch block height", err);
            }
        },

        approveWithdrawal: async (id: number) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/withdrawals/${id}/approve`, {
                    method: 'POST'
                });
                if (res.ok) {
                    get().fetchCryptoWithdrawals();
                    get().fetchHotWallets();
                    return true;
                } else {
                    const errData = await res.json();
                    alert("출금 승인 실패: " + (errData.error || "알 수 없는 오류"));
                }
            } catch (err) {
                console.error("Failed to approve withdrawal", err);
            }
            return false;
        },

        rejectWithdrawal: async (id: number) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/withdrawals/${id}/reject`, {
                    method: 'POST'
                });
                if (res.ok) {
                    get().fetchCryptoWithdrawals();
                    return true;
                }
            } catch (err) {
                console.error("Failed to reject withdrawal", err);
            }
            return false;
        },

        rebalanceHotWallet: async (id: number, amount: number) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/hot-wallets/${id}/rebalance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount })
                });
                if (res.ok) {
                    get().fetchHotWallets();
                    return true;
                }
            } catch (err) {
                console.error("Failed to rebalance hot wallet", err);
            }
            return false;
        },

        requestCryptoWithdrawal: async (userId: number, currency: string, amount: number, toAddress: string) => {
            try {
                const res = await fetchWithAuth(`${get().apiBaseUrl}/admin/crypto/withdraw`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, currency, amount, toAddress })
                });
                if (res.ok) {
                    get().fetchCryptoWithdrawals();
                    return true;
                } else {
                    const errData = await res.json();
                    alert("출금 요청 실패: " + (errData.error || "알 수 없는 오류"));
                }
            } catch (err) {
                console.error("Failed to request crypto withdrawal", err);
            }
            return false;
        }
    };
});
