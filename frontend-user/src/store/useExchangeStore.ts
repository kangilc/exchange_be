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

    // ⚡ 고성능 배치 렌더링용 추가 상태
    bids: [number, number][];
    asks: [number, number][];
    midPrice: number;
    spread: number;
    volumePower: number;
    latency: number;
    throughput: number;

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
    let orderbookChanged = false; // ⚡ 오더북 실질 데이터 변경 플래그

    const startUpdateLoop = () => {
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = setInterval(() => {
            const currentSymbol = get().activeSymbol;
            const hasNewTrades = recentTradesBuffer.length > 0;

            // ⚡ 신규 체결 정보도 없고 오더북 변동도 없으면 렌더 업데이트 및 연산 전체 생략!
            if (!hasNewTrades && !orderbookChanged) return;

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
                const topAsk = asksArr[0][0] / 100.0; // asksArr은 오름차순 정렬이므로 0번이 최선호가
                mid = (topBid + topAsk) / 2.0;
                diff = topAsk - topBid;
            }

            // 3. Zustand 스토어 일괄 업데이트
            set((state) => {
                let nextLogs = state.tradesLog; // ⚡ 변경 없을 시 얕은복사를 통한 불필요 참조 갱신 방지
                if (hasNewTrades) {
                    // 최신 체결건이 위로 가도록 안전하게 복제 후 반전 정렬하여 앞에 붙여줌
                    const copiedBuffer = [...recentTradesBuffer].reverse();
                    nextLogs = [...copiedBuffer, ...state.tradesLog].slice(0, 50);
                    // ⚡ 배열의 메모리 주소(참조)를 유지한 채 내용만 완전히 비워 경합 및 클로저 꼬임 해결
                    recentTradesBuffer.length = 0;
                }

                const matchingLog = nextLogs.find(l => l.symbol === currentSymbol);
                const lastPrice = matchingLog ? matchingLog.price : state.lastPrice;

                const nextState: any = {
                    bids: bidsArr,
                    asks: [...asksArr].reverse(), // 화면 렌더링용으로 반전
                    midPrice: mid,
                    spread: diff,
                    volumePower: power,
                    lastPrice
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
        }, 100); // ⚡ 100ms 초고속 스로틀링 배치 업데이트
    };

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

        initStore: async () => {
            const host = window.location.hostname || '127.0.0.1';
            let base = `http://${host}:8181`;
            let wsUrl = `ws://${host}:8088/ws`;

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
        }
    };
});
