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

    // 액션 메서드 선언
    initStore: () => Promise<void>;
    setActiveSymbol: (symbol: string) => void;
    setActiveResolution: (res: string) => void;
    setWsConnected: (connected: boolean) => void;
    updateTradeStats: (price: number, qty: number, side: 'BUY' | 'SELL', symbol: string) => void;
    addLoadedCandles: (candles: CandleData[]) => void;
    addRealtimeTick: (price: number) => void;
}

// 심볼 해시코드 상수
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

export const useExchangeStore = create<ExchangeState>((set, get) => {
    let ws: WebSocket | null = null;

    const connectWebSocket = (wsUrl: string) => {
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
        };

        ws.onclose = () => {
            set({ wsConnected: false });
            console.log('[거래소 웹소켓] 단절됨. 3초 후 재연결 시도...');
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

        initStore: async () => {
            try {
                // config.json 동적 연동
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
            // console.log(`[심볼 전환] ${symbol} 활성화 완료.`);
        },

        setActiveResolution: (res) => {
            set({ activeResolution: res });
            // console.log(`[해상도 전환] ${res} 활성화 완료.`);
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
            // 차트 캔들 실시간 갱신
        }
    };
});
