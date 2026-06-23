import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useExchangeStore } from '../store/useExchangeStore';

/**
 * ⚡ 호가창 개별 Row 컴포넌트 (OrderBookRow)
 * 
 * - 특정 호가(Price)의 수량 변동 발생 시 즉각적으로 네온 깜빡임(Neon Flash) 이펙트를 가동함.
 * - React.memo를 사용하여 전달받은 Props가 실질적으로 변경되지 않으면 불필요한 Repaint를 억제함.
 */
const OrderBookRow: React.FC<{
    /** 스케일(100) 반영된 원본 정수 가격 */
    price: number;
    /** 호가 잔량 */
    qty: number;
    /** 매도(ask) / 매수(bid) 구분 */
    side: 'ask' | 'bid';
    /** 시각적 잔량 누적을 표현할 배경 게이지 바의 백분율 너비 */
    barWidth: number;
    /** 해당 호가선까지의 누적 잔량 합계 */
    cumVal: number;
    /** 전일 종가 또는 기준 가격 (등락률 계산 목적) */
    basePrice: number;
    /** 수량 변경 타임스탬프 (깜빡임 트리거용) */
    lastChanged?: number;
    /** 호가 클릭 시 주문 가격 인풋 자동 입력 이벤트 */
    onClick?: () => void;
}> = React.memo(({ price, qty, side, barWidth, cumVal, basePrice, lastChanged = 0, onClick }) => {
    const prevChanged = useRef<number>(lastChanged);
    const [flashClass, setFlashClass] = useState<string>('');

    // 수량 변경(lastChanged 갱신) 감지 시 깜빡임 클래스 스위칭
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

    return (
        <div 
            onClick={onClick}
            className="grid grid-cols-3 py-1.5 px-4 hover:bg-white/5 relative group items-center transition-all duration-150 cursor-pointer"
        >
            {/* 누적 잔량의 크기를 나타내는 배경 비율 게이지 바 */}
            <div 
                className="absolute right-0 top-0 bottom-0 pointer-events-none opacity-20 transition-all duration-300"
                style={{
                    width: `${barWidth}%`,
                    backgroundColor: side === 'ask' ? '#ec4899' : '#06b6d4'
                }}
            />
            {/* 실시간 증감에 반응하는 네온 플래시 효과 오버레이 */}
            {flashClass && (
                <div className={`absolute inset-0 pointer-events-none transition-all ${flashClass}`} />
            )}
            <div className={`text-[10px] font-bold z-10 ${side === 'ask' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {realPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-right text-slate-100 z-10 font-bold">{qty.toLocaleString()}</div>
            <div className="text-right text-slate-400 z-10">{cumVal.toLocaleString()}</div>
        </div>
    );
});

interface OrderBookProps {
    /** 종목별 기준 가격 */
    basePrice: number;
    /** 화폐 단위 (USD, KRW 등) */
    fiat: string;
    /** 대상 코인 심볼 (BTC, ADA 등) */
    coin: string;
    /** 현재 입력된 주문 가격 */
    orderPrice: string;
    /** 주문 가격 변경 함수 */
    setOrderPrice: (price: string) => void;
    /** 주문 유형 (LIMIT, MARKET, STOP) */
    orderType: 'LIMIT' | 'MARKET' | 'STOP';
    /** 주문 유형 변경 함수 */
    setOrderType: (type: 'LIMIT' | 'MARKET' | 'STOP') => void;
    /** 모바일 가시성 조절을 위한 현재 활성화된 모바일 탭 정보 */
    mobileTab: string;
}

/**
 * ⚡ 실시간 10단 호가창 (OrderBook) 컴포넌트
 * 
 * [최적화 핵심 설계]
 * - WebSocket으로 수신되는asks, bids 델타 상태를 직접 구독하여 렌더링하도록 캡슐화함.
 * - useMemo와 이전 수량 보관 맵(FlashMapRef)을 통해 호가의 깜빡임 정보(lastChanged)를 최적 연산함.
 */
export const OrderBook: React.FC<OrderBookProps> = React.memo(({
    basePrice,
    fiat,
    coin,
    orderPrice,
    setOrderPrice,
    orderType,
    setOrderType,
    mobileTab
}) => {
    // Zustand 스토어에서 실시간 호가/시세 정보만 선별적 개별 구독
    const asksList = useExchangeStore(state => state.asks);
    const bidsList = useExchangeStore(state => state.bids);
    const volumePower = useExchangeStore(state => state.volumePower);
    const midPrice = useExchangeStore(state => state.midPrice);
    const spread = useExchangeStore(state => state.spread);

    // 깜빡임 처리를 위해 이전 가격별 잔량을 저장하는 Reference Map
    const asksFlashMapRef = useRef<Map<number, { qty: number; lastChanged: number }>>(new Map());
    const bidsFlashMapRef = useRef<Map<number, { qty: number; lastChanged: number }>>(new Map());

    // 매도(Ask) 호가 깜빡임 추적 및 가공
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

    // 매수(Bid) 호가 깜빡임 추적 및 가공
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

    return (
        <div className={`${mobileTab === 'order' || mobileTab === 'orderbook' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl flex-col overflow-hidden lg:h-[830px] order-1 lg:order-none`}>
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

            <div className="flex-1 flex flex-col font-mono text-[10px] min-h-0 overflow-hidden">
                {/* 1. 매도 호가 (Asks) 영역 - 위쪽으로 누적 합산 구조 */}
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

                {/* 2. 중앙 스프레드 / 현재가 표시 영역 */}
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

                {/* 3. 매수 호가 (Bids) 영역 - 아래쪽으로 누적 합산 구조 */}
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
    );
});
