import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useExchangeStore } from '../store/useExchangeStore';
import { TradingViewChart } from './TradingViewChart';
import { Wallet, X } from 'lucide-react';
import { OrderBook } from './OrderBook';
import { OrderConsole } from './OrderConsole';
import { CustodyCenter } from './CustodyCenter';
import { InvestmentHistory } from './InvestmentHistory';
import { RecentTradesList } from './RecentTradesList';

/**
 * ⚡ 마켓 현재가 깜빡임 컴포넌트 (PriceCell)
 * - 특정 코인 심볼의 시세 변동 시 색상 깜빡임 효과를 실시간 렌더링함.
 */
const PriceCell: React.FC<{ price: number; symbol: string }> = ({ price, symbol }) => {
    const prevPriceRef = React.useRef<number>(price);
    const [flashClass, setFlashClass] = React.useState<string>('');

    React.useEffect(() => {
        if (price !== prevPriceRef.current) {
            const isUp = price > prevPriceRef.current;
            const newClass = isUp ? 'flash-bid-inc' : 'flash-ask-inc';
            setFlashClass(newClass);
            const timer = setTimeout(() => setFlashClass(''), 450);
            prevPriceRef.current = price;
            return () => clearTimeout(timer);
        }
    }, [price]);

    return (
        <span className={`transition-all duration-150 rounded px-1.5 py-0.5 ${flashClass}`}>
            {price.toLocaleString(undefined, { minimumFractionDigits: symbol === 'BTC-USD' ? 2 : 0 })}
        </span>
    );
};

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

/**
 * ⚡ 거래 터미널 메인 컴포넌트 (TradingTerminal)
 * 
 * [최적화 & 최적 렌더링 설계]
 * - 30ms 주기로 폭증하는 orderbook 델타 수신 시, 본 부모 컴포넌트가 강제로 리렌더링되는 부하를 원천 배제함.
 * - OrderBook 및 RecentTradesList에 상태 구독을 완전히 넘겨주고, 본 컴포넌트는 정적 그리드 레이아웃만 유지함.
 * - 주문 전송 등 단발성 조회 연산이 필요한 경우 useExchangeStore.getState()를 통해 렌더링 없는 즉시 조회를 적용함.
 */
export const TradingTerminal: React.FC = React.memo(() => {
    // Zustand 스토어 상태 개별 구독 (Selector)
    const activeSymbol = useExchangeStore(state => state.activeSymbol);
    const activeResolution = useExchangeStore(state => state.activeResolution);
    const apiBaseUrl = useExchangeStore(state => state.apiBaseUrl);
    const latency = useExchangeStore(state => state.latency);
    const throughput = useExchangeStore(state => state.throughput);
    const wsConnected = useExchangeStore(state => state.wsConnected);
    const sendOrder = useExchangeStore(state => state.sendOrder);
    const setActiveSymbol = useExchangeStore(state => state.setActiveSymbol);
    const setActiveResolution = useExchangeStore(state => state.setActiveResolution);
    const authUserId = useExchangeStore(state => state.authUserId);
    const isAuthenticated = useExchangeStore(state => state.isAuthenticated);
    const setLoginModalOpen = useExchangeStore(state => state.setLoginModalOpen);
    const fetchUserBalances = useExchangeStore(state => state.fetchUserBalances);
    const fetchUserTrades = useExchangeStore(state => state.fetchUserTrades);
    const fetchUserLedgers = useExchangeStore(state => state.fetchUserLedgers);
    const markets = useExchangeStore(state => state.markets);
    const fetchMarkets = useExchangeStore(state => state.fetchMarkets);
    const tickerPrices = useExchangeStore(state => state.tickerPrices);
    const lastRejectEvent = useExchangeStore(state => state.lastRejectEvent);
    const clearRejectEvent = useExchangeStore(state => state.clearRejectEvent);

    // 1. 거래 터미널 로컬 코어 상태
    const activeTicker = tickerPrices[activeSymbol];
    const basePrice = activeTicker ? activeTicker.prevClosePrice : (activeSymbol === 'BTC-USD' ? 65000 : 500);
    const currentMarket = useMemo(() => markets.find((m: any) => m.symbol === activeSymbol), [markets, activeSymbol]);
    const minAmt = currentMarket ? currentMarket.minAmt : 0;
    const [activeTab, setActiveTab] = useState<'trade' | 'custody' | 'investment'>('trade');
    const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
    const [selectedSide, setSelectedSide] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP'>('LIMIT');

    // ⚡ 모바일 화면 전용 상단 탭 분리 제어 상태
    const [mobileTab, setMobileTab] = useState<'market' | 'order' | 'orderbook' | 'chart' | 'trades' | 'info'>('market');

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
        if (!isLiveMode || !isAuthenticated) return;

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
    }, [isLiveMode, isAuthenticated, fetchUserBalances, fetchUserTrades, fetchUserLedgers]);

    useEffect(() => {
        fetchMarkets();
    }, [fetchMarkets]);

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

    // 웹소켓 주문 거절(REJECT) 시 잔고 롤백 및 로그 출력
    useEffect(() => {
        if (lastRejectEvent) {
            const { symbol, side, price, qty, reason } = lastRejectEvent;
            const coin = symbol === 'BTC-USD' ? 'BTC' : 'ADA';
            const fiat = symbol === 'BTC-USD' ? 'USD' : 'KRW';
            const actualPrice = price / 100.0;
            const totalCost = actualPrice * qty;

            setBalances(prev => {
                const next = { ...prev };
                if (side === 'BUY') {
                    next[fiat] += totalCost;
                } else {
                    next[coin] += qty;
                }
                return next;
            });

            appendLog('warning', `주문거절 롤백: ${reason} (${qty} ${coin} @ ${actualPrice.toLocaleString()} ${fiat})`);
            
            // 처리 후 이벤트 즉시 초기화
            clearRejectEvent();
        }
    }, [lastRejectEvent, clearRejectEvent, appendLog]);

    // 4. 주문 터미널 제출 처리
    const handleOrderSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthenticated) {
            setLoginModalOpen(true);
            return;
        }
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
            const storeState = useExchangeStore.getState();
            const midPriceVal = storeState.midPrice;
            const tradesLogVal = storeState.tradesLog;
            finalPrice = midPriceVal > 0 ? midPriceVal : (tradesLogVal.find(t => t.symbol === activeSymbol)?.price || 0);
        } else if (isNaN(priceVal) || priceVal <= 0) {
            alert('올바른 가격을 입력해주세요.');
            return;
        }

        const totalCost = finalPrice * qtyVal;

        // 최소 주문 금액 유효성 검사
        if (minAmt > 0 && totalCost < minAmt) {
            alert(`주문 총액이 최소 주문 금액보다 작습니다. (최소: ${minAmt.toLocaleString()} ${fiat}, 현재: ${totalCost.toLocaleString()} ${fiat})`);
            return;
        }

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
                if (!isLiveMode) {
                    next[coin] += qtyVal; // Live 모드 시 체결 전까지는 코인을 지급하지 않음
                }
            } else {
                next[coin] -= qtyVal;
                if (!isLiveMode) {
                    next[fiat] += totalCost; // Live 모드 시 체결 전까지는 USD를 지급하지 않음
                }
            }
            return next;
        });

        // Live 백엔드 자산 동기화 (Live 모드 시)
        if (isLiveMode) {
            // 백엔드 db-persister가 ACCEPT(주문접수시 HOLD) 및 TRADE(체결시 정산) 이벤트를 통해
            // 데이터베이스의 사용가능/주문대기 잔고를 자동으로 안전하게 처리하므로,
            // 프론트엔드단에서 직접 API를 통한 자산 임의 조정은 이중 차감 및 데이터 꼬임의 원인이 되어 생략합니다.
            setTimeout(loadUserData, 1500); // 1.5초 후 최종 정산 잔고 확인
        }

        // WebSocket을 통해 매칭 엔진에 실시간 주문 발사
        const scaledPrice = Math.round(finalPrice * 100);
        const payload = {
            action: 'NEW',
            symbol: activeSymbol,
            side: selectedSide,
            price: scaledPrice,
            qty: Math.round(qtyVal),
            userId: authUserId || 1
        };

        const success = sendOrder(payload);
        if (success) {
            appendLog(selectedSide.toLowerCase() as any, `[주문 전송] ${qtyVal} ${coin} @ ${finalPrice.toLocaleString()} ${fiat}`);
        } else {
            appendLog('warning', '주문 전송 실패: 웹소켓 연결 상태를 확인해주세요.');
        }
    }, [wsConnected, orderPrice, orderQty, activeSymbol, orderType, selectedSide, balances, stopPrice, isLiveMode, apiBaseUrl, loadUserData, sendOrder, appendLog, authUserId, isAuthenticated, setLoginModalOpen, minAmt]);

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
            } catch (e) { }
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

    // 총 평가금액 환산
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

            {/* 🌌 메인 탭 전환 컨트롤러 */}
            <div className="flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-1 font-extrabold text-xs max-w-md">
                <button
                    onClick={() => setActiveTab('trade')}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'trade' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    📈 거래 터미널
                </button>
                <button
                    onClick={() => {
                        if (!isAuthenticated) {
                            setLoginModalOpen(true);
                            return;
                        }
                        setActiveTab('custody');
                    }}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'custody' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    💰 입출금 센터
                </button>
                <button
                    onClick={() => {
                        if (!isAuthenticated) {
                            setLoginModalOpen(true);
                            return;
                        }
                        setActiveTab('investment');
                    }}
                    className={`flex-1 py-3 rounded-xl text-center transition-all duration-150 ${activeTab === 'investment' ? 'bg-[#8a2be2] text-white shadow-lg shadow-[#8a2be2]/25' : 'text-slate-400 hover:text-white'}`}
                >
                    📊 투자내역 및 원장
                </button>
            </div>

            {/* [탭 1: 거래 터미널 화면] */}
            {activeTab === 'trade' && (
                <>
                    {/* ⚡ 모바일 전용 상단 탭 네비게이션 바 (데스크톱 lg 이상에서는 숨김) */}
                    <div className="flex lg:hidden bg-slate-950/60 border border-white/5 rounded-xl p-1 font-extrabold text-[10px] gap-1">
                        <button
                            type="button"
                            onClick={() => setMobileTab('market')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'market' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            마켓
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('order')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'order' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            주문
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('orderbook')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'orderbook' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            호가
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('chart')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'chart' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            차트
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('trades')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'trades' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            시세
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('info')}
                            className={`flex-1 py-2 rounded-lg text-center transition-all duration-150 ${mobileTab === 'info' ? 'bg-[#8a2be2] text-white shadow-lg font-black' : 'text-slate-400'}`}
                        >
                            정보
                        </button>
                    </div>

                    <div className={`grid ${mobileTab === 'order' ? 'grid-cols-2' : 'grid-cols-1'} lg:grid-cols-4 gap-4 lg:gap-6 items-start animate-fade-in`}>
                        {/* [1열] Real-time Orderbook Ladder */}
                        <OrderBook
                            basePrice={basePrice}
                            fiat={fiat}
                            coin={coin}
                            orderPrice={orderPrice}
                            setOrderPrice={setOrderPrice}
                            orderType={orderType}
                            setOrderType={setOrderType}
                            mobileTab={mobileTab}
                        />

                        {/* [2~3열] Middle Panel: Chart + Order Input */}
                        <div className={`${mobileTab === 'chart' || mobileTab === 'order' ? 'flex' : 'hidden'} lg:flex lg:col-span-2 flex-col gap-6 order-2 lg:order-none`}>
                            {/* Chart Window */}
                            <div className={`${mobileTab === 'chart' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-4 flex-col gap-3 flex-1 overflow-hidden relative`}>
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-extrabold text-white">{activeSymbol} 실시간 시세 차트</span>
                                        <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5 text-[10px] font-bold">
                                            {markets && markets.length > 0 ? (
                                                markets.map((m: any) => (
                                                    <button
                                                        key={m.symbol}
                                                        onClick={() => setActiveSymbol(m.symbol)}
                                                        className={`px-3 py-1 rounded transition-all ${activeSymbol === m.symbol ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                                    >
                                                        {m.symbol}
                                                     </button>
                                                ))
                                            ) : (
                                                <span className="px-3 py-1 text-slate-500">대기 중...</span>
                                            )}
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
                            <OrderConsole
                                orderPrice={orderPrice}
                                setOrderPrice={setOrderPrice}
                                orderQty={orderQty}
                                setOrderQty={setOrderQty}
                                stopPrice={stopPrice}
                                setStopPrice={setStopPrice}
                                orderType={orderType}
                                setOrderType={setOrderType}
                                selectedSide={selectedSide}
                                setSelectedSide={setSelectedSide}
                                balances={balances}
                                isAuthenticated={isAuthenticated}
                                handleOrderSubmit={handleOrderSubmit}
                                fiat={fiat}
                                coin={coin}
                                mobileTab={mobileTab}
                                minAmt={minAmt}
                            />
                        </div>

                        {/* [4열] smart Portfolio & Real-time Markets Table */}
                        <div className={`${mobileTab === 'trades' || mobileTab === 'info' || mobileTab === 'market' ? 'flex' : 'hidden'} lg:flex flex-col gap-6 lg:h-[830px] lg:col-span-1`}>
                            {/* Real-time Markets Table */}
                            <div className={`${mobileTab === 'market' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl flex-col flex-1 overflow-hidden min-h-[350px]`}>
                                <div className="p-4 border-b border-white/5 bg-white/2 text-sm font-extrabold text-white flex justify-between items-center">
                                    <span>실시간 마켓 목록</span>
                                    <span className="text-[10px] text-slate-500 font-medium">클릭 시 마켓 전환</span>
                                </div>
                                <div className="flex-1 overflow-y-auto w-full bg-black/10">
                                    <table className="w-full text-left text-[10px] font-medium font-mono">
                                        <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[9px] sticky top-0 bg-[#0a1020] z-10">
                                            <tr>
                                                <th className="px-3 py-3">심볼</th>
                                                <th className="px-3 py-3 text-right">현재가</th>
                                                <th className="px-3 py-3 text-right">대비</th>
                                                <th className="px-3 py-3 text-right">거래대금</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 font-bold">
                                            {markets && markets.length > 0 ? (
                                                markets.map((m: any) => {
                                                    const isSelected = activeSymbol === m.symbol;
                                                    const ticker = tickerPrices[m.symbol];
                                                    let displayPrice = ticker ? ticker.lastPrice : (m.symbol === 'BTC-USD' ? 65000 : 500);
                                                    let prevClose = ticker ? ticker.prevClosePrice : (m.symbol === 'BTC-USD' ? 65000 : 500);
                                                    let changePercent = prevClose > 0 ? ((displayPrice - prevClose) / prevClose) * 100 : 0;
                                                    const formattedChange = changePercent > 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
                                                    const changeColor = changePercent > 0 ? 'text-emerald-400' : (changePercent < 0 ? 'text-rose-400' : 'text-slate-400');
                                                    
                                                    const volumeAmount = m.symbol === 'BTC-USD' ? '32,410,500 USD' : '450,200,000 KRW';

                                                    return (
                                                        <tr 
                                                            key={m.symbol} 
                                                            onClick={() => setActiveSymbol(m.symbol)}
                                                            className={`hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-white/5' : ''}`}
                                                        >
                                                            <td className="px-3 py-3">
                                                                <span className="text-white block text-[11px] font-bold">{m.symbol}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-slate-200">
                                                                <PriceCell price={displayPrice} symbol={m.symbol} />
                                                            </td>
                                                            <td className={`px-3 py-3 text-right ${changeColor}`}>
                                                                {formattedChange}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-slate-400">
                                                                {volumeAmount}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="text-center py-6 text-slate-500">마켓 목록을 로딩 중입니다...</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Portfolio Asset Balance Card (요약) */}
                            <div className={`${mobileTab === 'info' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex-col gap-4`}>
                                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <Wallet size={14} className="text-[#8a2be2]" />
                                        실시간 보유 자산
                                    </span>
                                </div>
                                <div className="flex flex-col gap-3 font-mono text-xs">
                                    <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                        <span className="text-slate-400">보유 KRW</span>
                                        <span className="text-white font-bold">{!isAuthenticated ? '로그인 필요' : `${balances.KRW.toLocaleString()} KRW`}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                        <span className="text-slate-400">보유 USD</span>
                                        <span className="text-white font-bold">{!isAuthenticated ? '로그인 필요' : `${balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                        <span className="text-slate-400">보유 BTC</span>
                                        <span className="text-[#00f2fe] font-bold">{!isAuthenticated ? '로그인 필요' : `${balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 8 })} BTC`}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-white/5 pb-2">
                                        <span className="text-slate-400">보유 ADA</span>
                                        <span className="text-[#c084fc] font-bold">{!isAuthenticated ? '로그인 필요' : `${balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 8 })} ADA`}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3 text-[10px] font-bold mt-1">
                                    <button
                                        onClick={() => {
                                            if (!isAuthenticated) {
                                                setLoginModalOpen(true);
                                                return;
                                            }
                                            setCustodyCurrency('KRW');
                                            setCustodyAction('DEPOSIT');
                                            setActiveTab('custody');
                                        }}
                                        className="flex-1 py-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 transition-all text-center cursor-pointer"
                                    >
                                        입금하기
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!isAuthenticated) {
                                                setLoginModalOpen(true);
                                                return;
                                            }
                                            setCustodyCurrency('KRW');
                                            setCustodyAction('WITHDRAW');
                                            setActiveTab('custody');
                                        }}
                                        className="flex-1 py-2.5 rounded-lg border border-rose-500/25 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition-all text-center cursor-pointer"
                                    >
                                        출금하기
                                    </button>
                                </div>
                            </div>

                            {/* Real-time Trades List */}
                            <RecentTradesList mobileTab={mobileTab} />
                        </div>
                    </div>
                </>
            )}

            {/* [탭 2: 입출금 센터 화면] */}
            {activeTab === 'custody' && (
                <CustodyCenter
                    balances={balances}
                    custodyCurrency={custodyCurrency}
                    setCustodyCurrency={setCustodyCurrency}
                    custodyAction={custodyAction}
                    setCustodyAction={setCustodyAction}
                    withdrawAddressInput={withdrawAddressInput}
                    setWithdrawAddressInput={setWithdrawAddressInput}
                    otpInput={otpInput}
                    setOtpInput={setOtpInput}
                    custodyAmountInput={custodyAmountInput}
                    setCustodyAmountInput={setCustodyAmountInput}
                    handleCustodySubmit={handleCustodySubmit}
                    custodyHistory={custodyHistory}
                />
            )}

            {/* [탭 3: 투자내역 및 원장 화면] */}
            {activeTab === 'investment' && (
                <InvestmentHistory
                    userTrades={userTrades}
                    balances={balances}
                    totalAssetEvalValue={totalAssetEvalValue}
                    stopLimitOrdersList={stopLimitOrdersList}
                    setStopLimitOrders={setStopLimitOrders}
                    appendLog={appendLog}
                />
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
                                    <label className="text-slate-400 uppercase text-[10px]">신청 금액</label>
                                    <input
                                        type="number"
                                        required
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value)}
                                        placeholder="이체 신청 금액을 입력해 주세요."
                                        className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white font-mono font-bold outline-none"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-white/5 bg-white/2 flex justify-end gap-3 font-bold">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDepositModal(false);
                                        setShowWithdrawModal(false);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className={`px-5 py-2 rounded-lg text-white ${showDepositModal ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}
                                >
                                    {showDepositModal ? '입금 확인' : '출금 승인'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
