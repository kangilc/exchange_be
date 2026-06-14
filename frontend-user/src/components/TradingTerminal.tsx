import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useExchangeStore } from '../store/useExchangeStore';
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
    basePrice: number;
    lastChanged?: number;
    onClick?: () => void;
}> = React.memo(({ price, qty, side, barWidth, cumVal, basePrice, lastChanged = 0, onClick }) => {
    const prevChanged = useRef<number>(lastChanged);
    const [flashClass, setFlashClass] = useState<string>('');

    useEffect(() => {
        if (lastChanged > 0 && lastChanged !== prevChanged.current) {
            const newClass = side === 'ask' ? 'flash-ask-inc' : 'flash-bid-inc';
            setFlashClass(newClass);
            const timer = setTimeout(() => {
                setFlashClass('');
            }, 450);
            prevChanged.current = lastChanged;
            return () => clearTimeout(timer);
        }
        prevChanged.current = lastChanged;
    }, [lastChanged, side]);

    const realPrice = price / 100.0;
    const diffPercent = basePrice > 0 ? ((realPrice - basePrice) / basePrice) * 100 : 0;
    const sign = diffPercent > 0 ? '+' : '';
    const percentText = `${sign}${diffPercent.toFixed(2)}%`;
    const changeColor = diffPercent > 0 ? 'text-rose-400' : (diffPercent < 0 ? 'text-emerald-400' : 'text-slate-400');

    return (
        <div 
            onClick={onClick}
            className="grid grid-cols-3 py-1.5 px-4 hover:bg-white/5 relative group items-center transition-all duration-150 cursor-pointer"
        >
            {/* 기존 스타일 가로 백그라운드 색상 채우기: 매도는 좌측(left-0), 매수는 우측(right-0) */}
            <div 
                className={`absolute top-0 bottom-0 transition-all duration-300 pointer-events-none ${side === 'ask' ? 'left-0 bg-rose-500/10' : 'right-0 bg-emerald-500/10'}`} 
                style={{ width: `${barWidth}%` }} 
            />
            <div className="flex items-center gap-1.5 relative z-10">
                <span className={`font-bold ${side === 'ask' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {realPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-[9px] font-bold ${changeColor} opacity-90`}>
                    {percentText}
                </span>
            </div>
            <span className={`text-slate-300 relative z-10 text-right font-semibold rounded px-1.5 py-0.5 transition-all duration-150 ${flashClass}`}>{qty.toLocaleString()}</span>
            <span className="text-slate-500 relative z-10 text-right font-medium">{cumVal.toLocaleString()}</span>
        </div>
    );
});

export const TradingTerminal: React.FC = React.memo(() => {
    // ⚡ 어드민(60fps 정상작동)과 동일하게 모든 실시간 스트림 상태를 단일 컴포넌트가 직접 구독
    const activeSymbol = useExchangeStore(state => state.activeSymbol);
    const activeResolution = useExchangeStore(state => state.activeResolution);
    const apiBaseUrl = useExchangeStore(state => state.apiBaseUrl);
    const tradesLog = useExchangeStore(state => state.tradesLog);
    const bidsList = useExchangeStore(state => state.bids);
    const asksList = useExchangeStore(state => state.asks);
    const midPrice = useExchangeStore(state => state.midPrice);
    const spread = useExchangeStore(state => state.spread);
    const volumePower = useExchangeStore(state => state.volumePower);
    const latency = useExchangeStore(state => state.latency);
    const throughput = useExchangeStore(state => state.throughput);
    const wsConnected = useExchangeStore(state => state.wsConnected);
    const sendOrder = useExchangeStore(state => state.sendOrder);
    const setActiveSymbol = useExchangeStore(state => state.setActiveSymbol);
    const setActiveResolution = useExchangeStore(state => state.setActiveResolution);
    const authUserId = useExchangeStore(state => state.authUserId);
    const fetchUserBalances = useExchangeStore(state => state.fetchUserBalances);
    const fetchUserTrades = useExchangeStore(state => state.fetchUserTrades);
    const fetchUserLedgers = useExchangeStore(state => state.fetchUserLedgers);

    // 1. 거래 터미널 로컬 코어 상태
    const basePrice = activeSymbol === 'BTC-USD' ? 65000 : 500;
    const [activeTab, setActiveTab] = useState<'trade' | 'custody' | 'investment'>('trade');
    const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
    const [selectedSide, setSelectedSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP'>('LIMIT');
    
    // ⚡ 모바일 화면 전용 상단 탭 분리 제어 상태 ('trade' = 호가/주문/체결, 'chart' = 시세 차트)
    const [mobileTab, setMobileTab] = useState<'trade' | 'chart'>('trade');

    // 입력 폼 상태
    const [orderPrice, setOrderPrice] = useState<string>('');
    const [orderQty, setOrderQty] = useState<string>('');
    const [stopPrice, setStopPrice] = useState<string>('');

    // 보유 자산 상태 (샌드박스/라이브 모드 통합 지원)
    const [balances, setBalances] = useState<{ [key: string]: number }>({
        KRW: 0,
        USD: 0,
        BTC: 0,
        ADA: 0,
        JAF: 0
    });

    // 로그 및 체결 이력 상태
    const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
    const [stopLimitOrdersList, setStopLimitOrders] = useState<StopLimitOrder[]>([]);

    // 입출금 탭 전용 상태
    const [custodyCurrency, setCustodyCurrency] = useState<string>('KRW');
    const [custodyAmountInput, setCustodyAmountInput] = useState<string>('');
    const [withdrawAddressInput, setWithdrawAddressInput] = useState<string>('');
    const [otpInput, setOtpInput] = useState<string>('');
    const [custodyAction, setCustodyAction] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
    
    const [custodyHistory, setCustodyHistory] = useState<any[]>([]);

    // 입출금 팝업 제어 (레거시 코드 호환용)
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [modalCurrency, setModalCurrency] = useState('KRW');
    const [modalAmount, setModalAmount] = useState('');

    // 실제 유저의 거래 내역 보관 상태
    const [userTrades, setUserTrades] = useState<any[]>([]);

    // 가격별 이전 수량과 마지막 변경 시점(타임스탬프)을 보관하여 리마운트 후에도 깜빡임 상태를 복원
    const asksFlashMapRef = useRef<Map<number, { qty: number; lastChanged: number }>>(new Map());
    const bidsFlashMapRef = useRef<Map<number, { qty: number; lastChanged: number }>>(new Map());

    // 매도 호가 변경 감지
    const asksWithFlash = useMemo(() => {
        const now = Date.now();
        const prevMap = asksFlashMapRef.current;
        const nextMap = new Map<number, { qty: number; lastChanged: number }>();

        const result = asksList.map(([price, qty]) => {
            const prev = prevMap.get(price);
            let lastChanged = prev ? prev.lastChanged : 0;

            if (prev && prev.qty !== qty) {
                lastChanged = now;
            }

            nextMap.set(price, { qty, lastChanged });
            return { price, qty, lastChanged };
        });

        asksFlashMapRef.current = nextMap;
        return result;
    }, [asksList]);

    // 매수 호가 변경 감지
    const bidsWithFlash = useMemo(() => {
        const now = Date.now();
        const prevMap = bidsFlashMapRef.current;
        const nextMap = new Map<number, { qty: number; lastChanged: number }>();

        const result = bidsList.map(([price, qty]) => {
            const prev = prevMap.get(price);
            let lastChanged = prev ? prev.lastChanged : 0;

            if (prev && prev.qty !== qty) {
                lastChanged = now;
            }

            nextMap.set(price, { qty, lastChanged });
            return { price, qty, lastChanged };
        });

        bidsFlashMapRef.current = nextMap;
        return result;
    }, [bidsList]);

    // 실시간 체결 리스트 메모화 가공 (날짜 파싱 예외 방어 적용)
    const recentTrades = useMemo(() => {
        return tradesLog
            .filter(t => t && t.symbol === activeSymbol)
            .map(t => {
                let timeStr = '--:--:--';
                if (t.executedAt) {
                    const d = new Date(t.executedAt);
                    if (!isNaN(d.getTime())) {
                        timeStr = d.toTimeString().split(' ')[0];
                    }
                }
                return {
                    tradeId: t.tradeId || Math.random().toString(),
                    time: timeStr,
                    price: t.price || 0,
                    qty: t.qty || 0,
                    side: t.side || 'BUY'
                };
            });
    }, [tradesLog, activeSymbol]);

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

    // 지갑 자산 조회 및 사용자 거래 내역/원장 조회 연동
    const loadUserData = useCallback(async () => {
        if (!isLiveMode) return;
        
        // 1. 잔고 조회
        const userBal = await fetchUserBalances();
        if (userBal && Object.keys(userBal).length > 0) {
            setBalances(prev => ({ ...prev, ...userBal }));
        }

        // 2. 최근 체결 내역 조회
        const trades = await fetchUserTrades();
        setUserTrades(trades);

        // 3. 원장 입출금 이력 조회
        const ledgers = await fetchUserLedgers();
        const historyMapped = ledgers.map((item: any) => ({
            time: item.createdAt ? item.createdAt.replace('T', ' ').substring(0, 19) : '--',
            currency: item.currency,
            amount: item.amount,
            type: item.type,
            status: 'SUCCESS'
        }));
        setCustodyHistory(historyMapped);
    }, [isLiveMode, fetchUserBalances, fetchUserTrades, fetchUserLedgers]);

    useEffect(() => {
        loadUserData();
    }, [loadUserData, activeTab, activeSymbol]);

    // 콘솔 로그 유틸리티
    const appendLog = useCallback((type: 'buy' | 'sell' | 'system' | 'warning' | 'stop', message: string) => {
        const timeStr = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [{ time: timeStr, type, message }, ...prev].slice(0, 50));
    }, []);



    // 웹소켓 연결 상태 로깅
    useEffect(() => {
        if (wsConnected) {
            appendLog('system', '실시간 고성능 바이너리 웹소켓 게이트웨이 연결 활성화 완료.');
        } else {
            appendLog('warning', '웹소켓 게이트웨이 연결 단절. 스토어 재연결 대기 중...');
        }
    }, [wsConnected, appendLog]);

    // 4. 주문 터미널 제출 처리
    const handleOrderSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wsConnected) {
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
            finalPrice = midPrice > 0 ? midPrice : (tradesLog.find(t => t.symbol === activeSymbol)?.price || 0);
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
                const userId = authUserId || 1;
                await fetch(`${apiBaseUrl}/admin/users/${userId}/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currency: selectedSide === 'BUY' ? fiat : coin,
                        amount: selectedSide === 'BUY' ? -totalCost : -qtyVal
                    })
                });
                await fetch(`${apiBaseUrl}/admin/users/${userId}/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currency: selectedSide === 'BUY' ? coin : fiat,
                        amount: selectedSide === 'BUY' ? qtyVal : totalCost
                    })
                });
                setTimeout(loadUserData, 1500); // 1.5초 후 최종 정산 잔고 확인
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

        const success = sendOrder(payload);
        if (success) {
            appendLog(selectedSide.toLowerCase() as any, `[주문 전송] ${qtyVal} ${coin} @ ${finalPrice.toLocaleString()} ${fiat}`);
        } else {
            appendLog('warning', '주문 전송 실패: 웹소켓 연결 상태를 확인해주세요.');
        }
    }, [wsConnected, orderPrice, orderQty, activeSymbol, orderType, midPrice, tradesLog, selectedSide, balances, stopPrice, isLiveMode, apiBaseUrl, loadUserData, sendOrder, appendLog, authUserId]);

    // 레거시 모달창 처리 및 공통 입출금 핵심 비즈니스 로직
    const handleCustodySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(custodyAmountInput);
        if (isNaN(amt) || amt <= 0) {
            alert('정확한 금액을 입력해주세요.');
            return;
        }

        if (custodyAction === 'WITHDRAW' && balances[custodyCurrency] < amt) {
            alert('출금 가용 잔고가 부족합니다.');
            return;
        }

        if (custodyAction === 'WITHDRAW' && !withdrawAddressInput.trim()) {
            alert('출금 주소를 정확하게 입력해주세요.');
            return;
        }

        // 모의 2FA OTP 코드 체크 (임의 6자리 확인)
        if (custodyAction === 'WITHDRAW' && otpInput.length !== 6) {
            alert('구글 OTP 인증 번호 6자리를 올바르게 입력해주세요.');
            return;
        }

        const finalAmt = custodyAction === 'DEPOSIT' ? amt : -amt;

        // 로컬 잔고 반영
        setBalances(prev => ({
            ...prev,
            [custodyCurrency]: prev[custodyCurrency] + finalAmt
        }));

        // DB 백엔드 동기화 (Live 모드 시)
        if (isLiveMode) {
            try {
                const userId = authUserId || 1;
                await fetch(`${apiBaseUrl}/admin/users/${userId}/assets/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currency: custodyCurrency, amount: finalAmt })
                });
                setTimeout(loadUserData, 1500);
            } catch (e) {}
        }

        // 입출금 이력 누적
        const newHistoryItem = {
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            currency: custodyCurrency,
            amount: amt,
            type: custodyAction,
            status: 'SUCCESS'
        };
        setCustodyHistory(prev => [newHistoryItem, ...prev]);

        appendLog('system', `${custodyAction === 'DEPOSIT' ? '입금' : '출금'} 완료: ${amt.toLocaleString()} ${custodyCurrency}`);
        setCustodyAmountInput('');
        setWithdrawAddressInput('');
        setOtpInput('');
    };

    // 레거시 호환용 모달 서브밋
    const handleModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(modalAmount);
        if (isNaN(amt) || amt <= 0) return;
        setBalances(prev => ({ ...prev, [modalCurrency]: prev[modalCurrency] + (showDepositModal ? amt : -amt) }));
        setCustodyHistory(prev => [{
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            currency: modalCurrency,
            amount: amt,
            type: showDepositModal ? 'DEPOSIT' : 'WITHDRAW',
            status: 'SUCCESS'
        }, ...prev]);
        setShowDepositModal(false);
        setShowWithdrawModal(false);
        setModalAmount('');
    };

    const isBtc = activeSymbol === 'BTC-USD';
    const fiat = isBtc ? 'USD' : 'KRW';
    const coin = isBtc ? 'BTC' : 'ADA';

    // 총 평가금액 환산 (BTC = 65,000$, ADA = 500원 기준 간편 원화가치 합산)
    const totalAssetEvalValue = useMemo(() => {
        const krwVal = balances.KRW;
        const usdVal = balances.USD * 1350; // 1350원 고정 환율 가정
        const btcVal = balances.BTC * 65000 * 1350;
        const adaVal = balances.ADA * 500;
        return krwVal + usdVal + btcVal + adaVal;
    }, [balances]);

    return (
        <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 overflow-y-auto max-w-[1600px] animate-fade-in">
            {/* 1. Header Mini Status bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-3 gap-3">
                <div className="flex items-center gap-4 text-xs font-bold">
                    <button
                        onClick={() => setIsLiveMode(!isLiveMode)}
                        className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${isLiveMode ? 'bg-[#00f2fe]/10 border-[#00f2fe]/45 text-[#00f2fe] shadow-[0_0_12px_rgba(0,242,254,0.1)]' : 'bg-amber-500/10 border-amber-500/45 text-amber-400'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-[#00f2fe] animate-pulse' : 'bg-amber-500'}`} />
                        <span>{isLiveMode ? '실계좌 연동 모드 (Live DB)' : '모의투자 샌드박스 (Sandbox)'}</span>
                    </button>

                    <div className="stat-item hidden sm:flex items-center gap-1.5 text-slate-400">
                        <span>RTT 지연:</span>
                        <span className="font-mono text-emerald-400">{latency} ms</span>
                    </div>

                    <div className="stat-item hidden sm:flex items-center gap-1.5 text-slate-400">
                        <span>이벤트 TPS:</span>
                        <span className="font-mono text-[#8a2be2]">{throughput} msgs/s</span>
                    </div>
                </div>

                <div className="marquee-bar text-xs text-slate-500 font-semibold tracking-tight overflow-hidden text-right">
                    📢 [안내] 실시간 고성능 바이너리 웹소켓 게이트웨이 정상 가동 중
                </div>
            </div>

            {/* 🌌 메인 탭 전환 컨트롤러 (데스크톱 및 모바일 통합) */}
            <div className="flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-1 font-extrabold text-xs max-w-md">
                <button
                    onClick={() => setActiveTab('trade')}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'trade' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    📈 거래 터미널
                </button>
                <button
                    onClick={() => setActiveTab('custody')}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'custody' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    💰 입출금 센터
                </button>
                <button
                    onClick={() => setActiveTab('investment')}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'investment' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    📊 투자내역 및 원장
                </button>
            </div>

            {/* [탭 1: 거래 터미널 화면] */}
            {activeTab === 'trade' && (
                <>
                    {/* ⚡ 모바일 전용 상단 탭 네비게이션 바 (데스크톱 xl 이상에서는 숨김) */}
                    <div className="flex xl:hidden bg-slate-950/60 border border-white/5 rounded-xl p-1 font-extrabold text-xs">
                        <button
                            onClick={() => setMobileTab('trade')}
                            className={`flex-1 py-3 rounded-lg text-center transition-all duration-150 ${mobileTab === 'trade' ? 'bg-[#8a2be2] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            호가 및 모의 주문
                        </button>
                        <button
                            onClick={() => setMobileTab('chart')}
                            className={`flex-1 py-3 rounded-lg text-center transition-all duration-150 ${mobileTab === 'chart' ? 'bg-[#8a2be2] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            실시간 시세 차트
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start animate-fade-in">
                        {/* [1열] Real-time Orderbook Ladder */}
                        <div className={`${mobileTab === 'trade' ? 'flex' : 'hidden'} xl:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl flex-col overflow-hidden h-[calc(100vh-220px)] min-h-[650px] order-1 xl:order-none`}>
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2">
                                <span className="text-sm font-extrabold text-white flex items-center gap-2">
                                    <Layers size={14} className="text-[#8a2be2]" />
                                    실시간 10단 호가
                                </span>
                                <span className="text-[10px] text-[#00f2fe] font-extrabold font-mono">체결강도: {volumePower.toFixed(1)}%</span>
                            </div>

                            <div className="grid grid-cols-3 px-4 py-2 text-[9px] uppercase tracking-wider font-extrabold text-slate-500 border-b border-white/5 bg-slate-950/20">
                                <span>가격 ({fiat})</span>
                                <span className="text-right">수량 ({coin})</span>
                                <span className="text-right">누적 ({coin})</span>
                            </div>

                            <div className="flex-1 flex flex-col font-mono text-[10px] min-h-0">
                                <div className="flex-1 flex flex-col justify-end divide-y divide-white/2 min-h-0">
                                    {(() => {
                                        let cum = 0;
                                        const cumList: number[] = new Array(asksWithFlash.length);
                                        for (let i = asksWithFlash.length - 1; i >= 0; i--) {
                                            cum += asksWithFlash[i].qty;
                                            cumList[i] = cum;
                                        }
                                        const maxCum = cum > 0 ? cum : 1;

                                        return asksWithFlash.map(({ price, qty, lastChanged }) => {
                                            const cumVal = cumList[asksWithFlash.findIndex(a => a.price === price)];
                                            const barWidth = Math.min((qty / maxCum) * 350, 100);
                                            return (
                                                <OrderBookRow
                                                    key={`ask-${price}`}
                                                    price={price}
                                                    qty={qty}
                                                    side="ask"
                                                    barWidth={barWidth}
                                                    cumVal={cumVal}
                                                    basePrice={basePrice}
                                                    lastChanged={lastChanged}
                                                    onClick={() => {
                                                        setOrderPrice((price / 100.0).toString());
                                                        if (orderType === 'MARKET') {
                                                            setOrderType('LIMIT');
                                                        }
                                                    }}
                                                />
                                            );
                                        });
                                    })()}
                                </div>

                                <div className="bg-slate-950/85 border-y border-white/5 py-3 px-4 flex justify-between items-center text-center">
                                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Ask Spread</span>
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-white font-black tracking-tight">
                                                {midPrice > 0 ? (midPrice / 100.0).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '--'}
                                            </span>
                                            {midPrice > 0 && (
                                                <span className={`text-[10px] font-black ${midPrice / 100.0 - basePrice >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    {midPrice / 100.0 - basePrice >= 0 ? '+' : ''}{(((midPrice / 100.0 - basePrice) / basePrice) * 100).toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-[#00f2fe] font-bold mt-0.5">갭: {(spread / 100.0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {fiat}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">Bid Spread</span>
                                </div>

                                <div className="flex-1 flex flex-col justify-start divide-y divide-white/2 min-h-0">
                                    {(() => {
                                        let cum = 0;
                                        const cumList = bidsWithFlash.map(({ qty }) => {
                                            cum += qty;
                                            return cum;
                                        });
                                        const maxCum = cum > 0 ? cum : 1;

                                        return bidsWithFlash.map(({ price, qty, lastChanged }, idx) => {
                                            const cumVal = cumList[idx];
                                            const barWidth = Math.min((qty / maxCum) * 350, 100);
                                            return (
                                                <OrderBookRow
                                                    key={`bid-${price}`}
                                                    price={price}
                                                    qty={qty}
                                                    side="bid"
                                                    barWidth={barWidth}
                                                    cumVal={cumVal}
                                                    basePrice={basePrice}
                                                    lastChanged={lastChanged}
                                                    onClick={() => {
                                                        setOrderPrice((price / 100.0).toString());
                                                        if (orderType === 'MARKET') {
                                                            setOrderType('LIMIT');
                                                        }
                                                    }}
                                                />
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* [2~3열] Middle Panel: Chart + Order Input */}
                        <div className={`${mobileTab === 'chart' || mobileTab === 'trade' ? 'flex' : 'hidden'} xl:flex xl:col-span-2 flex-col gap-6 h-[calc(100vh-220px)] min-h-[650px]`}>
                            {/* Chart Window */}
                            <div className={`${mobileTab === 'chart' ? 'flex' : 'hidden'} xl:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-4 flex-col gap-3 flex-1 overflow-hidden relative`}>
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
                                        {(['1m', '5m', '15m', '1h', '1w', '1mo', '1y'] as const).map((res) => (
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
                            <div className={`${mobileTab === 'trade' ? 'flex' : 'hidden'} xl:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex-col gap-4 order-2 xl:order-none`}>
                                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <Layers size={14} className="text-[#8a2be2]" />
                                        모의 주문 콘솔
                                    </span>
                                </div>
                                
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

                                <form onSubmit={handleOrderSubmit} className="flex flex-col gap-4 text-xs font-semibold">
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

                        {/* [4열] smart Portfolio & Real-time Trades List */}
                        <div className={`${mobileTab === 'trade' ? 'flex' : 'hidden'} xl:flex flex-col gap-6 h-[calc(100vh-220px)] min-h-[650px] xl:col-span-1`}>
                            {/* Portfolio Asset Balance Card (요약) */}
                            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <Wallet size={14} className="text-[#8a2be2]" />
                                        실시간 보유 자산
                                    </span>
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
                                    <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                        <span className="text-slate-400">보유 ADA</span>
                                        <span className="text-[#c084fc] font-bold">{balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 8 })} ADA</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-[10px] font-bold mt-1">
                                    <button 
                                        onClick={() => {
                                            setCustodyCurrency('KRW');
                                            setCustodyAction('DEPOSIT');
                                            setActiveTab('custody');
                                        }}
                                        className="flex-1 py-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 transition-all text-center"
                                    >
                                        입금하기
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setCustodyCurrency('KRW');
                                            setCustodyAction('WITHDRAW');
                                            setActiveTab('custody');
                                        }}
                                        className="flex-1 py-2.5 rounded-lg border border-rose-500/25 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-all text-center"
                                    >
                                        출금하기
                                    </button>
                                </div>
                            </div>

                            {/* Real-time Trades List */}
                            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl flex flex-col flex-1 overflow-hidden h-[400px] xl:h-auto">
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
                </>
            )}

            {/* [탭 2: 입출금 센터 화면] */}
            {activeTab === 'custody' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-fade-in text-xs font-semibold">
                    {/* 좌측 2개열: 자산 카드 리스트 & 입출금 폼 */}
                    <div className="xl:col-span-2 flex flex-col gap-6">
                        {/* 자산 현황 카드 목록 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {['KRW', 'USD', 'BTC', 'ADA'].map((cur) => (
                                <div 
                                    key={cur}
                                    onClick={() => setCustodyCurrency(cur)}
                                    className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col gap-2 ${custodyCurrency === cur ? 'bg-[#8a2be2]/15 border-[#8a2be2] shadow-lg shadow-[#8a2be2]/10' : 'bg-[#0a1020]/45 border-white/5 hover:border-white/10'}`}
                                >
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase">{cur === 'KRW' ? '원화 (KRW)' : cur === 'USD' ? '달러 (USD)' : cur === 'BTC' ? '비트코인 (BTC)' : '에이다 (ADA)'}</span>
                                    <span className={`text-base font-black font-mono ${cur === 'BTC' ? 'text-[#00f2fe]' : cur === 'ADA' ? 'text-[#c084fc]' : 'text-white'}`}>
                                        {balances[cur].toLocaleString(undefined, { minimumFractionDigits: cur === 'KRW' ? 0 : cur === 'USD' ? 2 : 6 })}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* 입출금 신청 입력 카드 */}
                        <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
                            <div className="border-b border-white/5 pb-3 flex justify-between items-center">
                                <span className="text-sm font-extrabold text-white uppercase">{custodyCurrency} 입출금 신청서</span>
                                <div className="flex bg-white/2 border border-white/5 rounded-xl p-0.5 text-[10px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setCustodyAction('DEPOSIT')}
                                        className={`px-4 py-1.5 rounded-lg transition-all ${custodyAction === 'DEPOSIT' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}
                                    >
                                        입금 (Deposit)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCustodyAction('WITHDRAW')}
                                        className={`px-4 py-1.5 rounded-lg transition-all ${custodyAction === 'WITHDRAW' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
                                    >
                                        출금 (Withdraw)
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleCustodySubmit} className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 입금용 정보 피드백 */}
                                    {custodyAction === 'DEPOSIT' ? (
                                        <div className="bg-white/2 border border-white/5 rounded-xl p-4 flex flex-col gap-3 justify-center md:col-span-2">
                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">아래 가상 주소(계좌)로 이체(입금) 시 1초 내 자동 정산됩니다.</span>
                                            <div className="flex items-center justify-between font-mono bg-black/40 p-3 rounded-lg border border-white/5 mt-1">
                                                <span className="text-white font-bold text-xs select-all">
                                                    {custodyCurrency === 'KRW' ? '우리은행 1002-887-123456 (가상계좌)' : custodyCurrency === 'USD' ? 'CITIBANK 9982-111-9988 (가상계좌)' : custodyCurrency === 'BTC' ? '1BTC_DEPOSIT_ADDR_USER1_XXXXXXXXX' : 'addr1_ADA_DEPOSIT_ADDR_USER1_XXXX'}
                                                </span>
                                                <span className="text-[10px] text-emerald-400 font-extrabold border border-emerald-500/25 px-1.5 py-0.5 rounded uppercase">COPY</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* 출금 대상 주소 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">출금 대상 주소 (계좌번호)</label>
                                                <input 
                                                    type="text"
                                                    value={withdrawAddressInput}
                                                    onChange={(e) => setWithdrawAddressInput(e.target.value)}
                                                    placeholder="수령인의 정확한 주소를 입력해 주세요."
                                                    className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                                />
                                            </div>
                                            {/* 구글 OTP 인증 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px] text-rose-400">구글 2FA OTP 보안인증 (6자리)</label>
                                                <input 
                                                    type="text"
                                                    maxLength={6}
                                                    value={otpInput}
                                                    onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                                                    placeholder="OTP 번호 6자리를 입력해주세요."
                                                    className="w-full p-3 bg-black/30 border border-rose-500/30 rounded-lg text-white font-mono text-center font-bold outline-none focus:border-rose-500"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* 신청 금액 */}
                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <label className="text-slate-400 uppercase">신청 수량 / 금액</label>
                                            <span className="text-slate-400">
                                                가용 잔고: {balances[custodyCurrency].toLocaleString()} {custodyCurrency}
                                            </span>
                                        </div>
                                        <div className="relative flex items-center">
                                            <input 
                                                type="number" 
                                                step="any"
                                                required
                                                value={custodyAmountInput}
                                                onChange={(e) => setCustodyAmountInput(e.target.value)}
                                                placeholder="신청할 수량을 입력해주세요."
                                                className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                            />
                                            <span className="absolute right-4 text-slate-400 font-bold">{custodyCurrency}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className={`w-full py-3.5 rounded-xl font-extrabold text-white text-sm shadow-xl transition-all hover:scale-[1.01] mt-2 ${custodyAction === 'DEPOSIT' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'}`}
                                >
                                    {custodyAction === 'DEPOSIT' ? '입금 승인 완료 처리' : '출금 자산 안전 승인'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* 우측 1개열: 최근 입출금 변동 이력 타임라인 */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 h-[calc(100vh-270px)] min-h-[500px]">
                        <span className="text-sm font-extrabold text-white border-b border-white/5 pb-2">최근 입출금 내역 (원장 이력)</span>
                        <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
                            {custodyHistory.length === 0 ? (
                                <span className="text-slate-500 py-12 text-center">기록된 원장 이력이 없습니다.</span>
                            ) : (
                                custodyHistory.map((item, idx) => (
                                    <div key={idx} className="bg-slate-950/40 border border-white/5 p-3.5 rounded-xl flex flex-col gap-2 font-mono text-[10px]">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">{item.time}</span>
                                            <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] border uppercase ${item.type === 'DEPOSIT' ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border-rose-500/35 text-rose-400'}`}>
                                                {item.type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-white font-bold">{item.amount.toLocaleString()} {item.currency}</span>
                                            <span className="text-emerald-400 font-extrabold">완료</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* [탭 3: 투자내역 및 원장 화면] */}
            {activeTab === 'investment' && (
                <div className="flex flex-col gap-6 animate-fade-in text-xs font-semibold">
                    {/* 상단: 총 투자 평가 요약 카드 */}
                    {(() => {
                        // userTrades 기반 매수 단가 동적 연산
                        const btcBuyOrders = userTrades.filter(t => t.symbol === 'BTC-USD' && t.side === 'BUY');
                        const btcTotalQty = btcBuyOrders.reduce((sum, t) => sum + Number(t.qty), 0);
                        const btcAvgPrice = btcTotalQty > 0 ? (btcBuyOrders.reduce((sum, t) => sum + (Number(t.qty) * (Number(t.price) / 100.0)), 0) / btcTotalQty) : 65000;

                        const adaBuyOrders = userTrades.filter(t => t.symbol === 'ADA-KRW' && t.side === 'BUY');
                        const adaTotalQty = adaBuyOrders.reduce((sum, t) => sum + Number(t.qty), 0);
                        const adaAvgPrice = adaTotalQty > 0 ? (adaBuyOrders.reduce((sum, t) => sum + (Number(t.qty) * (Number(t.price) / 100.0)), 0) / adaTotalQty) : 500;

                        // 실제 매수된 총 금액 원화 환산 (BTC: USD -> KRW 고정환율 1350원)
                        const btcInvestedKrw = btcTotalQty * btcAvgPrice * 1350;
                        const adaInvestedKrw = adaTotalQty * adaAvgPrice;
                        const totalInvestedKrw = btcInvestedKrw + adaInvestedKrw;

                        // 현재 자산 평가액 원화 환산
                        const btcCurrentKrw = balances.BTC * 65000 * 1350;
                        const adaCurrentKrw = balances.ADA * 500;
                        const totalCurrentAssetKrw = btcCurrentKrw + adaCurrentKrw;

                        const profitKrw = totalCurrentAssetKrw - totalInvestedKrw;
                        const profitPercent = totalInvestedKrw > 0 ? (profitKrw / totalInvestedKrw) * 100 : 0;

                        return (
                            <>
                                <div className="bg-gradient-to-r from-[#0d1426] to-[#0a1020] border border-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">총 평가 금액 (환산 원화)</span>
                                        <span className="text-2xl font-black font-mono text-white mt-1">
                                            {totalAssetEvalValue.toLocaleString()} 원
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">총 매수 금액 (원화 환산)</span>
                                        <span className="text-2xl font-black font-mono text-slate-300 mt-1">
                                            {totalInvestedKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })} 원
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">평가 손익금</span>
                                        <span className={`text-2xl font-black font-mono mt-1 ${profitKrw >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                                            {profitKrw >= 0 ? '+' : ''}{profitKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })} 원
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">총 평가 수익률</span>
                                        <span className={`text-2xl font-black font-mono mt-1 ${profitKrw >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                                            {profitKrw >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>

                                {/* 중단: 자산별 상세 평가 목록 테이블 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                                    <span className="text-sm font-extrabold text-white border-b border-white/5 pb-2">코인별 평가 현황 원장</span>
                                    <div className="overflow-x-auto w-full rounded-xl border border-white/5 bg-slate-950/20">
                                        <table className="w-full text-left text-xs font-semibold">
                                            <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                                <tr>
                                                    <th className="px-5 py-3.5">보유 자산</th>
                                                    <th className="px-5 py-3.5 text-right">보유 수량</th>
                                                    <th className="px-5 py-3.5 text-right">매수 평균가</th>
                                                    <th className="px-5 py-3.5 text-right">평가 금액</th>
                                                    <th className="px-5 py-3.5 text-right">평가 손익 (%)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-bold font-mono">
                                                {/* BTC */}
                                                <tr className="hover:bg-white/2 transition-colors">
                                                    <td className="px-5 py-4 text-white font-extrabold">BTC (비트코인)</td>
                                                    <td className="px-5 py-4 text-right">{balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 8 })} BTC</td>
                                                    <td className="px-5 py-4 text-right">${btcAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-5 py-4 text-right">{(balances.BTC * 65000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</td>
                                                    <td className="px-5 py-4 text-right text-slate-400">0.00%</td>
                                                </tr>
                                                {/* ADA */}
                                                <tr className="hover:bg-white/2 transition-colors">
                                                    <td className="px-5 py-4 text-white font-extrabold">ADA (에이다)</td>
                                                    <td className="px-5 py-4 text-right">{balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 8 })} ADA</td>
                                                    <td className="px-5 py-4 text-right">{adaAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} KRW</td>
                                                    <td className="px-5 py-4 text-right">{(balances.ADA * 500).toLocaleString()} KRW</td>
                                                    <td className="px-5 py-4 text-right text-slate-400">0.00%</td>
                                                </tr>
                                                {/* KRW */}
                                                <tr className="hover:bg-white/2 transition-colors">
                                                    <td className="px-5 py-4 text-white font-extrabold">KRW (대한민국 원)</td>
                                                    <td className="px-5 py-4 text-right">{balances.KRW.toLocaleString()} KRW</td>
                                                    <td className="px-5 py-4 text-right">1.00 KRW</td>
                                                    <td className="px-5 py-4 text-right">{balances.KRW.toLocaleString()} KRW</td>
                                                    <td className="px-5 py-4 text-right text-slate-400">0.00%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* 하단: 미체결 예약 대기 주문 리스트 */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                        <span className="text-sm font-extrabold text-white border-b border-white/5 pb-2">미체결 감시 예약 주문 (Active Stop-Limit Orders)</span>
                        <div className="overflow-x-auto w-full rounded-xl border border-white/5 bg-slate-950/20">
                            <table className="w-full text-left text-xs font-semibold">
                                <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                    <tr>
                                        <th className="px-5 py-3.5">주문 ID</th>
                                        <th className="px-5 py-3.5">거래 종목</th>
                                        <th className="px-5 py-3.5">구분</th>
                                        <th className="px-5 py-3.5 text-right">감시 가격</th>
                                        <th className="px-5 py-3.5 text-right">주문 가격</th>
                                        <th className="px-5 py-3.5 text-right">수량</th>
                                        <th className="px-5 py-3.5 text-right">상태</th>
                                        <th className="px-5 py-3.5 text-center">동작</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-bold font-mono">
                                    {stopLimitOrdersList.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-6 text-slate-500">대기 중인 예약 주문이 없습니다.</td>
                                        </tr>
                                    ) : (
                                        stopLimitOrdersList.map((order) => (
                                            <tr key={order.id} className="hover:bg-white/2 transition-colors">
                                                <td className="px-5 py-3 text-slate-400">{order.id}</td>
                                                <td className="px-5 py-3 text-white font-extrabold">{order.symbol}</td>
                                                <td className="px-5 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${order.side === 'BUY' ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                        {order.side}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-slate-300">{order.stopPrice.toLocaleString()}</td>
                                                <td className="px-5 py-3 text-right text-white">{order.price.toLocaleString()}</td>
                                                <td className="px-5 py-3 text-right text-slate-300">{order.qty.toLocaleString()}</td>
                                                <td className="px-5 py-3 text-right text-amber-400 font-extrabold">{order.status}</td>
                                                <td className="px-5 py-3 text-center">
                                                    <button 
                                                        onClick={() => {
                                                            setStopLimitOrders(prev => prev.filter(o => o.id !== order.id));
                                                            appendLog('system', `예약주문이 취소되었습니다: ${order.id}`);
                                                        }}
                                                        className="px-3 py-1 bg-rose-500/15 border border-rose-500/35 text-rose-400 rounded-lg hover:bg-rose-500/30 transition-all font-bold text-[10px]"
                                                    >
                                                        취소
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Log window (하단 고정 공통 콘솔) */}
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

            {/* POPUP MODALS (레거시 호환용) */}
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
                                        <option value="JAF">JAF (자바에프)</option>
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
});
