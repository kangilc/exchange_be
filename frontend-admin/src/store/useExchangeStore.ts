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
}

// 심볼 해시코드 상수
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

export const useExchangeStore = create<ExchangeState>((set, get) => {
    let ws: WebSocket | null = null;

    const connectWebSocket = (wsUrl: string) => {
        if (ws) {
            // 이전 소켓의 이벤트 핸들러를 제거하여 중복 재연결 타이머 유발 방지
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
        };

        ws.onclose = () => {
            set({ wsConnected: false });
            console.log('[어드민 웹소켓] 단절됨. 3초 후 재연결 시도...');
            setTimeout(() => {
                const currentWsUrl = get().wsUrl;
                if (currentWsUrl) connectWebSocket(currentWsUrl);
            }, 3000);
        };

        ws.onmessage = (event) => {
            const data = event.data;
            if (typeof data === 'string') return; // PING-PONG 바이패스

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

            // 체결 틱 조건 (qtyNum < 0)
            if (qtyNum < 0) {
                const actualQty = Math.abs(qtyNum);
                const actualPrice = priceNum / 100.0;

                // 스태츠 갱신
                get().updateTradeStats(actualPrice, actualQty, side === 0 ? 'BUY' : 'SELL', msgSymbol);
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

            // 웹소켓 자동 접속 트리거
            const currentWs = get().wsUrl;
            connectWebSocket(currentWs);
        },

        setActiveSymbol: (symbol) => {
            set({ activeSymbol: symbol, lastPrice: 0 });
            console.log(`[심볼 전환] ${symbol} 활성화 완료.`);
        },

        setActiveResolution: (res) => {
            set({ activeResolution: res });
            console.log(`[해상도 전환] ${res} 활성화 완료.`);
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users`);
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users`, {
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users/${userId}`, {
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
                    fetch(`${get().apiBaseUrl}/admin/wallets`),
                    fetch(`${get().apiBaseUrl}/admin/users`)
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
                const res = await fetch(`${get().apiBaseUrl}/admin/wallets/summary`);
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users/${userId}/assets/adjust`, {
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
                const res = await fetch(`${get().apiBaseUrl}/admin/ledgers?page=${page}&size=${size}${searchParam}`);
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users/${userId}/ledgers?page=0&size=50`);
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
                const res = await fetch(`${get().apiBaseUrl}/admin/users/${userId}/trades?page=0&size=50`);
                if (res.ok) {
                    const data = await res.json();
                    return data.content || [];
                }
            } catch (err) {
                console.error("Failed to fetch user trades", err);
            }
            return [];
        }
    };
});
