import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { useExchangeStore } from '../store/useExchangeStore';

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

    return (
        <div 
            onClick={onClick}
            className="grid grid-cols-3 py-1.5 px-4 hover:bg-white/5 relative group items-center transition-all duration-150 cursor-pointer"
        >
            <div 
                className="absolute right-0 top-0 bottom-0 pointer-events-none opacity-20 transition-all duration-300"
                style={{
                    width: `${barWidth}%`,
                    backgroundColor: side === 'ask' ? '#ec4899' : '#06b6d4'
                }}
            />
            {/* ⚡ 네온 플래시(Neon Flash) 효과 오버레이 */}
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
    basePrice: number;
    fiat: string;
    coin: string;
    orderPrice: string;
    setOrderPrice: (price: string) => void;
    orderType: 'LIMIT' | 'MARKET' | 'STOP';
    setOrderType: (type: 'LIMIT' | 'MARKET' | 'STOP') => void;
    mobileTab: string;
}

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
    const asksList = useExchangeStore(state => state.asks);
    const bidsList = useExchangeStore(state => state.bids);
    const volumePower = useExchangeStore(state => state.volumePower);
    const midPrice = useExchangeStore(state => state.midPrice);
    const spread = useExchangeStore(state => state.spread);

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
    );
});
