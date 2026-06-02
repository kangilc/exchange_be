import React, { useEffect, useState, useRef } from 'react';
import { useExchangeStore, BTC_SYMBOL_ID, ADA_SYMBOL_ID } from '../store/useExchangeStore';
import { TradingViewChart } from './TradingViewChart';
import { Layers, Wallet, X } from 'lucide-react';

interface StopLimitOrder {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    stopPrice: number;
    price: number;
    qty: number;
    time: string;
    status: string;
}

// ⚡ 실시간 잔량 증감에 따른 네온 깜빡임 이펙트(Neon Flash)를 감지하는 호가별 Row 컴포넌트
const OrderBookRow: React.FC<{
    price: number;
    qty: number;
    side: 'ask' | 'bid';
    barWidth: number;
    cumVal: number;
}> = ({ price, qty, side, barWidth, cumVal }) => {
    const prevQty = useRef<number>(qty);
    const [flashClass, setFlashClass] = useState<string>('');

    useEffect(() => {
        if (qty !== prevQty.current) {
            const isInc = qty > prevQty.current;
            const newClass = isInc 
                ? (side === 'ask' ? 'flash-ask-inc' : 'flash-bid-inc')
                : 'flash-dec';
            
            setFlashClass(newClass);
            
            // 450ms 경과 후 플래시 CSS 클래스 자동 초기화
            const timer = setTimeout(() => {
                setFlashClass('');
            }, 450);
            
            prevQty.current = qty;
            return () => clearTimeout(timer);
        }
    }, [qty, side]);

    return (
        <div className={`grid grid-cols-3 py-1.5 px-4 hover:bg-white/5 relative group items-center transition-all duration-150 ${flashClass}`}>
            <div className={`absolute right-0 top-0 bottom-0 transition-all duration-300 pointer-events-none ${side === 'ask' ? 'bg-rose-500/8' : 'bg-emerald-500/8'}`} style={{ width: `${barWidth}%` }} />
            <span className={`relative z-10 font-bold ${side === 'ask' ? 'text-rose-400' : 'text-emerald-400'}`}>{(price / 100.0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-300 relative z-10 text-right font-semibold">{qty.toLocaleString()}</span>
            <span className="text-slate-500 relative z-10 text-right font-medium">{cumVal.toLocaleString()}</span>
        </div>
    );
};

export const TradingTerminal: React.FC = () => {
    const {
        activeSymbol,
        activeResolution,
        apiBaseUrl,
        setActiveSymbol,
        setActiveResolution
    } = useExchangeStore();

    // 1. 거래 터미널 로컬 코어 상태
    const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
    const [, setWsConnected] = useState<boolean>(false);
    const [latency, setLatency] = useState<number>(0);
    const [throughput, setThroughput] = useState<number>(0);
    const [selectedSide, setSelectedSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP'>('LIMIT');

    // 입력 폼 상태
    const [orderPrice, setOrderPrice] = useState<string>('');
    const [orderQty, setOrderQty] = useState<string>('');
    const [stopPrice, setStopPrice] = useState<string>('');

    // 보유 자산 상태 (샌드박스/라이브 모드 통합 지원)
    const [balances, setBalances] = useState<{ [key: string]: number }>({
        KRW: 1000000000,
        USD: 10000,
        BTC: 10,
        ADA: 100000
    });

    // 실시간 인메모리 호가 장부 (rAF/성능 최적화용 레퍼런스 유지)
    const bidsMapRef = useRef<Map<number, number>>(new Map());
    const asksMapRef = useRef<Map<number, number>>(new Map());

    // 렌더링 동기화용 로컬 상태
    const [bidsList, setBidsList] = useState<[number, number][]>([]);
    const [asksList, setAsksList] = useState<[number, number][]>([]);
    const [midPrice, setMidPrice] = useState<number>(0);
    const [spread, setSpread] = useState<number>(0);
    const [volumePower, setVolumePower] = useState<number>(100.0);

    // 로그 및 체결 이력 상태
    const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
    const [recentTrades, setRecentTrades] = useState<any[]>([]);
    const [, setStopLimitOrders] = useState<StopLimitOrder[]>([]);

    // 입출금 팝업 제어
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [modalCurrency, setModalCurrency] = useState('KRW');
    const [modalAmount, setModalAmount] = useState('');

    // 성능 계측용 레퍼런스
    const wsRef = useRef<WebSocket | null>(null);
    const msgCountRef = useRef<number>(0);
    const recentTradesPowerRef = useRef<{ side: number; qty: number; time: number }[]>([]);
    const lastTradePriceRef = useRef<number>(0);

    // 심볼별 기본 디폴트 금액 세팅
    useEffect(() => {
        if (activeSymbol === 'BTC-USD') {
            setOrderPrice('65000');
            setOrderQty('2');
            setStopPrice('64000');
        } else {
            setOrderPrice('1200');
            setOrderQty('500');
            setStopPrice('1100');
        }
    }, [activeSymbol]);

    // 콘솔 로그 유틸리티
    const appendLog = (type: 'buy' | 'sell' | 'system' | 'warning' | 'stop', message: string) => {
        const timeStr = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [{ time: timeStr, type, message }, ...prev].slice(0, 50));
    };

    // 2. REST API 기반 풀 오더북 스냅샷 연동 (BTC: 9100, ADA: 9101)
    const fetchFullSnapshot = async (symbol: string) => {
        const port = symbol === 'BTC-USD' ? 9100 : 9101;
        const rawHost = window.location.hostname || '127.0.0.1';
        const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
        const url = `http://${host}:${port}/snapshot`;

        appendLog('system', `${symbol} 풀 오더북 스냅샷 동기화 시작...`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            bidsMapRef.current.clear();
            asksMapRef.current.clear();

            if (data.bids) {
                data.bids.forEach(([price, qty]: [number, number]) => {
                    bidsMapRef.current.set(price, qty);
                });
            }
            if (data.asks) {
                data.asks.forEach(([price, qty]: [number, number]) => {
                    asksMapRef.current.set(price, qty);
                });
            }

            appendLog('system', `${symbol} 스냅샷 복구 완료 (Seq: ${data.seq}, 매수: ${data.bids?.length || 0}건, 매도: ${data.asks?.length || 0}건)`);
            triggerRender();
        } catch (err: any) {
            appendLog('warning', `${symbol} 스냅샷 동기화 실패: ${err.message}`);
        }
    };

    // 지갑 자산 조회 (Live 모드 연동)
    const fetchLiveBalances = async () => {
        if (!isLiveMode) return;
        try {
            const res = await fetch(`${apiBaseUrl}/admin/wallets/user/1`); // 기본 1번 유저 바인딩
            if (res.ok) {
                const data = await res.json();
                const balMap: any = {};
                data.forEach((w: any) => {
                    balMap[w.currency] = parseFloat(w.balance);
                });
                setBalances(prev => ({ ...prev, ...balMap }));
            }
        } catch (err) {
            console.error("Failed to fetch live balances", err);
        }
    };

    useEffect(() => {
        fetchLiveBalances();
    }, [isLiveMode, apiBaseUrl]);

    // 3. 바이너리 실시간 오더북/체결 스트리밍 게이트웨이 기동
    useEffect(() => {
        const rawHost = window.location.hostname || '127.0.0.1';
        const host = rawHost === 'localhost' ? '127.0.0.1' : rawHost;
        const wsUrl = `ws://${host}:8088/ws`;

        appendLog('system', `초저지연 바이너리 웹소켓 연결 중: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.binaryType = 'arraybuffer';

        let pingIntervalId: any = null;

        ws.onopen = () => {
            setWsConnected(true);
            appendLog('system', '연결 성공! 실시간 바이너리 오더북 스트리밍 활성화.');

            // 초기 풀 스냅샷 적재
            fetchFullSnapshot(activeSymbol);

            // 2초 간격 PING-PONG 지연 계측 루프
            pingIntervalId = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: 'PING', timestamp: Date.now() }));
                }
            }, 2000);
        };

        ws.onclose = () => {
            setWsConnected(false);
            appendLog('warning', '웹소켓 게이트웨이 연결 단절. 3초 후 재접속을 진행합니다.');
            if (pingIntervalId) clearInterval(pingIntervalId);
        };

        ws.onerror = () => {
            appendLog('warning', '웹소켓 채널 통신 장애 감지');
        };

        ws.onmessage = (event) => {
            msgCountRef.current++;
            const data = event.data;

            // PING-PONG 응답 핸들러
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.action === 'PONG') {
                        const rtt = Date.now() - parsed.timestamp;
                        setLatency(rtt);
                    }
                } catch (e) {}
                return;
            }

            // 32바이트 초경량 바이너리 프레임 파싱
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

            // 실시간 체결 처리 (qtyNum < 0)
            if (qtyNum < 0) {
                const actualQty = Math.abs(qtyNum);
                const displayPrice = priceNum / 100.0;

                // 해당 종목 체결 시, 최종 체결가 및 실시간 틱 갱신
                if (msgSymbol === activeSymbol) {
                    lastTradePriceRef.current = priceNum;
                    
                    // 체결 강도 갱신
                    recentTradesPowerRef.current.push({ side, qty: actualQty, time: Date.now() });
                    if (recentTradesPowerRef.current.length > 200) recentTradesPowerRef.current.shift();

                    let buySum = 0;
                    let sellSum = 0;
                    recentTradesPowerRef.current.forEach(t => {
                        if (t.side === 1) buySum += t.qty;
                        else sellSum += t.qty;
                    });
                    const power = sellSum > 0 ? (buySum / sellSum) * 100 : 100;
                    setVolumePower(power);

                    // 실시간 체결 패널 누적
                    const tradeItem = {
                        tradeId: Date.now().toString().substring(7) + Math.floor(Math.random() * 10),
                        time: new Date().toLocaleTimeString().split(' ')[0],
                        price: displayPrice,
                        qty: actualQty,
                        side: side === 0 ? 'BUY' : 'SELL'
                    };
                    setRecentTrades(prev => [tradeItem, ...prev].slice(0, 50));
                }
            }

            // 실시간 오더북 장부 갱신 (지정 심볼만)
            if (msgSymbol === activeSymbol) {
                const targetMap = side === 0 ? bidsMapRef.current : asksMapRef.current;
                const currentQty = targetMap.get(priceNum) || 0;
                const nextQty = currentQty + qtyNum;

                if (nextQty <= 0) {
                    targetMap.delete(priceNum);
                } else {
                    targetMap.set(priceNum, nextQty);
                }

                // 렌더 틱 실행
                triggerRender();
            }
        };

        // TPS (초당 처리량) 측정 계측기
        const tpsIntervalId = setInterval(() => {
            setThroughput(msgCountRef.current);
            msgCountRef.current = 0;
        }, 1000);

        return () => {
            if (ws) {
                ws.onopen = null;
                ws.onclose = null;
                ws.onmessage = null;
                ws.close();
            }
            if (pingIntervalId) clearInterval(pingIntervalId);
            clearInterval(tpsIntervalId);
        };
    }, [activeSymbol]);

    // 실시간 호가 정렬 렌더링 트리거
    const triggerRender = () => {
        // 매수 10단 정렬 (내림차순)
        const bidsArr = Array.from(bidsMapRef.current.entries())
            .sort((a, b) => b[0] - a[0])
            .slice(0, 10);

        // 매도 10단 정렬 (오름차순 후 매도 사다리를 위해 반대로 렌더)
        const asksArr = Array.from(asksMapRef.current.entries())
            .sort((a, b) => a[0] - b[0])
            .slice(0, 10);

        setBidsList(bidsArr);
        setAsksList(asksArr.reverse()); // 화면에는 높은 매도 호가가 위에 깔려야 하므로 반전

        if (bidsArr.length > 0 && asksArr.length > 0) {
            const topBid = bidsArr[0][0] / 100.0;
            const topAsk = asksArr[asksArr.length - 1][0] / 100.0;
            const mid = (topBid + topAsk) / 2.0;
            const diff = topAsk - topBid;

            setMidPrice(mid);
            setSpread(diff);
        }
    };

    // 4. 주문 터미널 제출 처리
    const handleOrderSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            appendLog('warning', '터미널이 게이트웨이와 연결되어 있지 않습니다.');
            return;
        }

        const priceVal = parseFloat(orderPrice);
        const qtyVal = parseFloat(orderQty);
        const coin = activeSymbol === 'BTC-USD' ? 'BTC' : 'ADA';
        const fiat = activeSymbol === 'BTC-USD' ? 'USD' : 'KRW';

        if (isNaN(qtyVal) || qtyVal <= 0) {
            alert('올바른 수량을 입력해주세요.');
            return;
        }

        let finalPrice = priceVal;
        if (orderType === 'MARKET') {
            finalPrice = midPrice > 0 ? midPrice : (lastTradePriceRef.current / 100);
        } else if (isNaN(priceVal) || priceVal <= 0) {
            alert('올바른 가격을 입력해주세요.');
            return;
        }

        const totalCost = finalPrice * qtyVal;

        // 자산 잔고 가드 체크
        if (selectedSide === 'BUY') {
            if (balances[fiat] < totalCost) {
                alert(`잔고가 부족합니다! (필요 잔액: ${totalCost.toLocaleString()} ${fiat})`);
                return;
            }
        } else {
            if (balances[coin] < qtyVal) {
                alert(`보유 코인이 부족합니다! (필요 코인: ${qtyVal.toLocaleString()} ${coin})`);
                return;
            }
        }

        // A. 예약 주문 (STOP_LIMIT) 로컬 추가
        if (orderType === 'STOP') {
            const stopPriceVal = parseFloat(stopPrice);
            if (isNaN(stopPriceVal) || stopPriceVal <= 0) {
                alert('올바른 감시 가격(Stop Price)을 설정해주세요.');
                return;
            }

            const newStopOrder: StopLimitOrder = {
                id: 'SLO-' + Math.floor(100000 + Math.random() * 900000),
                symbol: activeSymbol,
                side: selectedSide,
                stopPrice: stopPriceVal,
                price: finalPrice,
                qty: qtyVal,
                time: new Date().toLocaleTimeString(),
                status: '감시 중'
            };

            setStopLimitOrders(prev => [newStopOrder, ...prev]);
            appendLog('stop', `예약주문 활성화: 감시가 ${stopPriceVal} / 주문가 ${finalPrice} (${qtyVal} ${coin})`);
            return;
        }

        // B. 일반 주문 (LIMIT / MARKET) 처리
        // 로컬 지갑 차감 (모의투자 및 실시간 UI 반응성 제공)
        setBalances(prev => {
            const next = { ...prev };
            if (selectedSide === 'BUY') {
                next[fiat] -= totalCost;
                next[coin] += qtyVal;
            } else {
                next[coin] -= qtyVal;
                next[fiat] += totalCost;
            }
            return next;
        });

        // Live 백엔드 자산 동기화 (Live 모드 시)
        if (isLiveMode) {
            try {
                await fetch(`${apiBaseUrl}/admin/users/1/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currency: selectedSide === 'BUY' ? fiat : coin,
                        amount: selectedSide === 'BUY' ? -totalCost : -qtyVal
                    })
                });
                await fetch(`${apiBaseUrl}/admin/users/1/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currency: selectedSide === 'BUY' ? coin : fiat,
                        amount: selectedSide === 'BUY' ? qtyVal : totalCost
                    })
                });
                setTimeout(fetchLiveBalances, 1500); // 1.5초 후 최종 정산 잔고 확인
            } catch (err) {}
        }

        // WebSocket을 통해 매칭 엔진에 실시간 주문 발사
        const scaledPrice = Math.round(finalPrice * 100);
        const payload = {
            action: 'NEW',
            symbol: activeSymbol,
            side: selectedSide,
            price: scaledPrice,
            qty: Math.round(qtyVal)
        };

        wsRef.current.send(JSON.stringify(payload));
        appendLog(selectedSide.toLowerCase() as any, `[주문 전송] ${qtyVal} ${coin} @ ${finalPrice.toLocaleString()} ${fiat}`);
    };

    // 입출금 신청 즉시 처리
    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(modalAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('정확한 금액을 입력해주세요.');
            return;
        }

        if (showWithdrawModal && balances[modalCurrency] < amt) {
            alert('출금 가용 잔액이 부족합니다.');
            return;
        }

        const finalAmt = showDepositModal ? amt : -amt;

        // 로컬 잔고 반영
        setBalances(prev => ({
            ...prev,
            [modalCurrency]: prev[modalCurrency] + finalAmt
        }));

        // DB 백엔드 동기화 (Live 모드 시)
        if (isLiveMode) {
            try {
                await fetch(`${apiBaseUrl}/admin/users/1/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currency: modalCurrency, amount: finalAmt })
                });
                setTimeout(fetchLiveBalances, 1500);
            } catch (e) {}
        }

        appendLog('system', `${showDepositModal ? '입금' : '출금'} 완료: ${amt.toLocaleString()} ${modalCurrency}`);
        setShowDepositModal(false);
        setShowWithdrawModal(false);
        setModalAmount('');
    };

    const isBtc = activeSymbol === 'BTC-USD';
    const fiat = isBtc ? 'USD' : 'KRW';
    const coin = isBtc ? 'BTC' : 'ADA';

    return (
        <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-[1600px] animate-fade-in">
            {/* Header Mini Status bar */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-4 text-xs font-bold">
                    <button
                        onClick={() => {
                            setIsLiveMode(!isLiveMode);
                            appendLog('system', `거래소 환경 전환: ${!isLiveMode ? '실계좌 연동 (LIVE DB)' : '모의투자 모드 (Local Sandbox)'}`);
                        }}
                        className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${isLiveMode ? 'bg-[#00f2fe]/10 border-[#00f2fe]/45 text-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.1)]' : 'bg-amber-500/10 border-amber-500/45 text-amber-400'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-[#00f2fe] animate-pulse' : 'bg-amber-500'}`} />
                        <span>{isLiveMode ? '실계좌 연동 모드 (Live DB)' : '모의투자 샌드박스 (Sandbox)'}</span>
                    </button>

                    <div className="stat-item flex items-center gap-1.5 text-slate-400">
                        <span>RTT 지연:</span>
                        <span className="font-mono text-emerald-400">{latency} ms</span>
                    </div>

                    <div className="stat-item flex items-center gap-1.5 text-slate-400">
                        <span>이벤트 TPS:</span>
                        <span className="font-mono text-[#8a2be2]">{throughput} msgs/s</span>
                    </div>
                </div>

                <div className="marquee-bar text-xs text-slate-500 font-semibold tracking-tight overflow-hidden w-[400px] text-right">
                    📢 [안내] 실시간 고성능 바이너리 웹소켓 게이트웨이 정상 가동 중
                </div>
            </div>

            {/* Main Trading Area Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                
                {/* 1. Real-time Orderbook Ladder (좌측 1열) */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl flex flex-col overflow-hidden h-[830px]">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2">
                        <span className="text-sm font-extrabold text-white flex items-center gap-2">
                            <Layers size={14} className="text-[#8a2be2]" />
                            실시간 10단 호가
                        </span>
                        <span className="text-[10px] text-[#00f2fe] font-extrabold font-mono">체결강도: {volumePower.toFixed(1)}%</span>
                    </div>

                    {/* Column Headers */}
                    <div className="grid grid-cols-3 px-4 py-2 text-[9px] uppercase tracking-wider font-extrabold text-slate-500 border-b border-white/5 bg-slate-950/20">
                        <span>가격 ({fiat})</span>
                        <span className="text-right">수량 ({coin})</span>
                        <span className="text-right">누적 ({coin})</span>
                    </div>

                    <div className="flex-1 flex flex-col font-mono text-[10px]">
                        {/* Ask Side (Sell) */}
                        <div className="flex-1 flex flex-col justify-end divide-y divide-white/2">
                            {(() => {
                                const asksWithCum = [...asksList];
                                let cum = 0;
                                const cumList: number[] = new Array(asksWithCum.length);
                                for (let i = asksWithCum.length - 1; i >= 0; i--) {
                                    cum += asksWithCum[i][1];
                                    cumList[i] = cum;
                                }
                                const maxCum = cum > 0 ? cum : 1;

                                return asksWithCum.map(([price, qty], idx) => {
                                    const cumVal = cumList[idx];
                                    const barWidth = Math.min((qty / maxCum) * 350, 100); // Proportional visual fill
                                    return (
                                        <OrderBookRow
                                            key={idx}
                                            price={price}
                                            qty={qty}
                                            side="ask"
                                            barWidth={barWidth}
                                            cumVal={cumVal}
                                        />
                                    );
                                });
                            })()}
                        </div>

                        {/* Mid Spread Indicator */}
                        <div className="bg-slate-950/85 border-y border-white/5 py-3 px-4 flex justify-between items-center text-center">
                            <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Ask Spread</span>
                            <div className="flex flex-col items-center">
                                <span className="text-sm text-white font-black tracking-tight">{midPrice > 0 ? midPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--'}</span>
                                <span className="text-[9px] text-[#00f2fe] font-bold mt-0.5">갭: {spread.toLocaleString(undefined, { minimumFractionDigits: 2 })} {fiat}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Bid Spread</span>
                        </div>

                        {/* Bid Side (Buy) */}
                        <div className="flex-1 flex flex-col justify-start divide-y divide-white/2">
                            {(() => {
                                let cum = 0;
                                const cumList = bidsList.map(([_, qty]) => {
                                    cum += qty;
                                    return cum;
                                });
                                const maxCum = cum > 0 ? cum : 1;

                                return bidsList.map(([price, qty], idx) => {
                                    const cumVal = cumList[idx];
                                    const barWidth = Math.min((qty / maxCum) * 350, 100);
                                    return (
                                        <OrderBookRow
                                            key={idx}
                                            price={price}
                                            qty={qty}
                                            side="bid"
                                            barWidth={barWidth}
                                            cumVal={cumVal}
                                        />
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                {/* 2. Middle Panel: Chart + Order Input (중앙 2~3열) */}
                <div className="xl:col-span-2 flex flex-col gap-6 h-[830px]">
                    {/* Chart Window */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 flex-1 overflow-hidden relative">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-extrabold text-white">{activeSymbol} 실시간 시세 차트</span>
                                <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5 text-[10px] font-bold">
                                    <button
                                        onClick={() => setActiveSymbol('BTC-USD')}
                                        className={`px-3 py-1 rounded transition-all ${activeSymbol === 'BTC-USD' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        BTC-USD
                                    </button>
                                    <button
                                        onClick={() => setActiveSymbol('ADA-KRW')}
                                        className={`px-3 py-1 rounded transition-all ${activeSymbol === 'ADA-KRW' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        ADA-KRW
                                    </button>
                                </div>
                            </div>
                            <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5 text-[10px] font-bold">
                                {(['1m', '5m', '15m', '1h'] as const).map((res) => (
                                    <button
                                        key={res}
                                        onClick={() => setActiveResolution(res)}
                                        className={`px-2 py-1 rounded uppercase transition-all ${activeResolution === res ? 'bg-[#8a2be2] text-white' : 'text-slate-400'}`}
                                    >
                                        {res}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            <TradingViewChart />
                        </div>
                    </div>

                    {/* Order Terminal Input */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="flex bg-white/2 border border-white/5 rounded-xl p-0.5 font-bold text-xs">
                            <button
                                onClick={() => setSelectedSide('BUY')}
                                className={`flex-1 py-2.5 rounded-lg transition-all ${selectedSide === 'BUY' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                매수 (BUY)
                            </button>
                            <button
                                onClick={() => setSelectedSide('SELL')}
                                className={`flex-1 py-2.5 rounded-lg transition-all ${selectedSide === 'SELL' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                매도 (SELL)
                            </button>
                        </div>

                        <form onSubmit={handleOrderSubmit} className="grid grid-cols-2 gap-4 text-xs font-semibold">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 구분</label>
                                    <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5 font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setOrderType('LIMIT')}
                                            className={`flex-1 py-2 rounded-md text-[10px] transition-all ${orderType === 'LIMIT' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            LIMIT
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOrderType('MARKET')}
                                            className={`flex-1 py-2 rounded-md text-[10px] transition-all ${orderType === 'MARKET' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            MARKET
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOrderType('STOP')}
                                            className={`flex-1 py-2 rounded-md text-[10px] transition-all ${orderType === 'STOP' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            STOP
                                        </button>
                                    </div>
                                </div>

                                {orderType === 'STOP' && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-slate-400 uppercase text-[10px] text-amber-500">감시 가격 (Trigger Price)</label>
                                        <div className="relative flex items-center">
                                            <input 
                                                type="number" 
                                                value={stopPrice}
                                                onChange={(e) => setStopPrice(e.target.value)}
                                                className="w-full p-2.5 bg-black/30 border border-amber-500/40 rounded-lg text-white font-mono font-bold outline-none"
                                            />
                                            <span className="absolute right-3 text-amber-500 font-bold">{fiat}</span>
                                        </div>
                                    </div>
                                )}

                                {orderType !== 'MARKET' && (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-slate-400 uppercase text-[10px]">주문 가격</label>
                                        <div className="relative flex items-center">
                                            <input 
                                                type="number" 
                                                value={orderPrice}
                                                onChange={(e) => setOrderPrice(e.target.value)}
                                                className="w-full p-2.5 bg-black/30 border border-white/10 rounded-lg text-white font-mono font-bold outline-none focus:border-[#8a2be2]"
                                            />
                                            <span className="absolute right-3 text-slate-400 font-bold">{fiat}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-slate-400 uppercase text-[10px]">주문 수량</label>
                                        <span className="text-[9px] text-[#00f2fe] font-bold">
                                            주문가능: {selectedSide === 'BUY' ? `${balances[fiat].toLocaleString()} ${fiat}` : `${balances[coin].toLocaleString()} ${coin}`}
                                        </span>
                                    </div>
                                    <div className="relative flex items-center">
                                        <input 
                                            type="number" 
                                            value={orderQty}
                                            onChange={(e) => setOrderQty(e.target.value)}
                                            className="w-full p-2.5 bg-black/30 border border-white/10 rounded-lg text-white font-mono font-bold outline-none focus:border-[#8a2be2]"
                                        />
                                        <span className="absolute right-3 text-slate-400 font-bold">{coin}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center bg-white/2 border border-white/5 rounded-xl p-3.5 mt-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">주문 총액</span>
                                    <span className="text-lg font-black font-mono text-[#00f2fe]">
                                        {orderType === 'MARKET'
                                            ? 'MARKET PRICE'
                                            : `${((parseFloat(orderPrice) || 0) * (parseFloat(orderQty) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${fiat}`}
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    className={`w-full py-3.5 rounded-xl font-extrabold text-white text-sm shadow-xl transition-all hover:scale-[1.01] ${selectedSide === 'BUY' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`}
                                >
                                    {selectedSide === 'BUY' ? '매수 주문 전송' : '매도 주문 전송'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* 3. smart Portfolio & Real-time Trades List (우측 4열) */}
                <div className="flex flex-col gap-6 h-[830px]">
                    {/* Portfolio Asset Balance Card */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                        <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                <Wallet size={14} className="text-[#8a2be2]" />
                                실시간 보유 자산
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">1번 가상 지갑 계정</span>
                        </div>
                        <div className="flex flex-col gap-3 font-mono text-xs">
                            <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                <span className="text-slate-400">보유 KRW</span>
                                <span className="text-white font-bold">{balances.KRW.toLocaleString()} KRW</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                <span className="text-slate-400">보유 USD</span>
                                <span className="text-white font-bold">{balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</span>
                            </div>
                            <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                <span className="text-slate-400">보유 BTC</span>
                                <span className="text-[#00f2fe] font-bold">{balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 8 })} BTC</span>
                            </div>
                            <div className="flex justify-between pb-1">
                                <span className="text-slate-400">보유 ADA</span>
                                <span className="text-[#c084fc] font-bold">{balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 8 })} ADA</span>
                            </div>
                        </div>
                        <div className="flex gap-3 text-[10px] font-bold mt-1">
                            <button 
                                onClick={() => {
                                    setModalCurrency('KRW');
                                    setShowDepositModal(true);
                                }}
                                className="flex-1 py-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            >
                                입금 신청
                            </button>
                            <button 
                                onClick={() => {
                                    setModalCurrency('KRW');
                                    setShowWithdrawModal(true);
                                }}
                                className="flex-1 py-2.5 rounded-lg border border-rose-500/25 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-all"
                            >
                                출금 신청
                            </button>
                        </div>
                    </div>

                    {/* Real-time Trades List */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl flex flex-col flex-1 overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/2 text-sm font-extrabold text-white">
                            실시간 체결 내역
                        </div>
                        <div className="flex-1 overflow-y-auto w-full bg-black/10">
                            <table className="w-full text-left text-[10px] font-medium font-mono">
                                <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[9px] sticky top-0 bg-[#0a1020] z-10">
                                    <tr>
                                        <th className="px-3 py-2">시간</th>
                                        <th className="px-3 py-2 text-right">체결가</th>
                                        <th className="px-3 py-2 text-right">수량</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-bold">
                                    {recentTrades.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="text-center py-6 text-slate-500">실시간 체결 대기 중...</td>
                                        </tr>
                                    ) : (
                                        recentTrades.map((t, idx) => (
                                            <tr key={idx} className="hover:bg-white/2 transition-colors">
                                                <td className="px-3 py-2 text-slate-400">{t.time}</td>
                                                <td className={`px-3 py-2 text-right ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-300">{t.qty.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>

            {/* 4. Bottom Log window (실시간 매칭 로그 콘솔) */}
            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                    실시간 매칭 로그 콘솔 (TCP Binary Matcher Packet Terminal)
                </div>
                <div className="h-[120px] overflow-y-auto bg-black/35 rounded-xl border border-white/5 p-4 font-mono text-[10px] flex flex-col gap-1">
                    {consoleLogs.length === 0 ? (
                        <span className="text-slate-500">&gt; 시스템 대기 중... 바이너리 패킷 이벤트 수신 대기</span>
                    ) : (
                        consoleLogs.map((log, idx) => (
                            <div key={idx} className="flex gap-2">
                                <span className="text-slate-500">[{log.time}]</span>
                                <span className={`font-bold ${log.type === 'buy' ? 'text-emerald-400' : log.type === 'sell' ? 'text-rose-400' : log.type === 'stop' ? 'text-[#c084fc]' : log.type === 'warning' ? 'text-rose-500' : 'text-blue-400'}`}>
                                    {log.type === 'buy' ? '[매수 체결]' : log.type === 'sell' ? '[매도 체결]' : log.type === 'stop' ? '[예약 주문]' : log.type === 'warning' ? '[경고]' : '[시스템]'}
                                </span>
                                <span className="text-slate-300">{log.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ======================================================= */}
            {/* POPUP MODALS (입출금 모달 시스템) */}
            {/* ======================================================= */}
            {(showDepositModal || showWithdrawModal) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in text-xs font-semibold">
                    <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[420px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">
                                {showDepositModal ? '가상 자산 입금 신청' : '가상 자산 출금 신청'}
                            </span>
                            <button 
                                onClick={() => {
                                    setShowDepositModal(false);
                                    setShowWithdrawModal(false);
                                }} 
                                className="text-slate-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleModalSubmit}>
                            <div className="p-6 flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">입출금 대상 자산</label>
                                    <select 
                                        value={modalCurrency}
                                        onChange={(e) => setModalCurrency(e.target.value)}
                                        className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none"
                                    >
                                        <option value="KRW">KRW (원화)</option>
                                        <option value="USD">USD (달러)</option>
                                        <option value="BTC">BTC (비트코인)</option>
                                        <option value="ADA">ADA (에이다)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">금액 / 수량</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value)}
                                        placeholder="입출금할 수량을 입력해주세요."
                                        required
                                        className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowDepositModal(false);
                                        setShowWithdrawModal(false);
                                    }} 
                                    className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5"
                                >
                                    취소
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-bold shadow-lg hover:brightness-110"
                                >
                                    {showDepositModal ? '입금 승인' : '출금 승인'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

