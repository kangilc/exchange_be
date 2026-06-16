import React from 'react';
import { Layers } from 'lucide-react';

interface OrderConsoleProps {
    orderPrice: string;
    setOrderPrice: (p: string) => void;
    orderQty: string;
    setOrderQty: (q: string) => void;
    stopPrice: string;
    setStopPrice: (p: string) => void;
    orderType: 'LIMIT' | 'MARKET' | 'STOP';
    setOrderType: (t: 'LIMIT' | 'MARKET' | 'STOP') => void;
    selectedSide: 'BUY' | 'SELL';
    setSelectedSide: (s: 'BUY' | 'SELL') => void;
    balances: { [key: string]: number };
    isAuthenticated: boolean;
    handleOrderSubmit: (e: React.FormEvent) => void;
    fiat: string;
    coin: string;
    mobileTab: string;
}

export const OrderConsole: React.FC<OrderConsoleProps> = React.memo(({
    orderPrice,
    setOrderPrice,
    orderQty,
    setOrderQty,
    stopPrice,
    setStopPrice,
    orderType,
    setOrderType,
    selectedSide,
    setSelectedSide,
    balances,
    isAuthenticated,
    handleOrderSubmit,
    fiat,
    coin,
    mobileTab
}) => {
    return (
        <div className={`${mobileTab === 'order' ? 'flex' : 'hidden'} xl:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex-col gap-4 order-2 xl:order-none`}>
            <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                <span className="flex items-center gap-2">
                    <Layers size={14} className="text-[#8a2be2]" />
                    모의 주문 콘솔
                </span>
            </div>
            
            <div className="flex bg-white/2 border border-white/5 rounded-xl p-0.5 font-bold text-xs">
                <button
                    type="button"
                    onClick={() => setSelectedSide('BUY')}
                    className={`flex-1 py-2.5 rounded-lg transition-all ${selectedSide === 'BUY' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    매수 (BUY)
                </button>
                <button
                    type="button"
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
                                지정가
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrderType('MARKET')}
                                className={`flex-1 py-2 rounded-md text-[10px] transition-all ${orderType === 'MARKET' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                시장가
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrderType('STOP')}
                                className={`flex-1 py-2 rounded-md text-[10px] transition-all ${orderType === 'STOP' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                예약(스탑)
                            </button>
                        </div>
                    </div>

                    {/* 감시 가격 슬롯 */}
                    <div className="flex flex-col gap-1">
                        <label className={`text-[10px] uppercase transition-all ${orderType === 'STOP' ? 'text-amber-500 font-bold' : 'text-slate-500'}`}>
                            감시 가격 (Trigger Price)
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                value={orderType === 'STOP' ? stopPrice : ''}
                                disabled={orderType !== 'STOP'}
                                placeholder={orderType === 'STOP' ? '' : '지정가/시장가 주문 (감시가 없음)'}
                                onChange={(e) => setStopPrice(e.target.value)}
                                className={`w-full p-2.5 bg-black/30 border rounded-lg font-mono font-bold outline-none transition-all ${orderType === 'STOP' ? 'border-amber-500/40 text-white' : 'border-white/5 text-slate-500 cursor-not-allowed opacity-50'}`}
                            />
                            <span className={`absolute right-3 font-bold ${orderType === 'STOP' ? 'text-amber-500' : 'text-slate-600'}`}>{fiat}</span>
                        </div>
                    </div>

                    {/* 주문 가격 슬롯 */}
                    <div className="flex flex-col gap-1">
                        <label className={`text-[10px] uppercase transition-all ${orderType !== 'MARKET' ? 'text-slate-400' : 'text-slate-500'}`}>
                            주문 가격
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                value={orderType !== 'MARKET' ? orderPrice : ''}
                                disabled={orderType === 'MARKET'}
                                placeholder={orderType !== 'MARKET' ? '' : '시장가 체결 (최적가로 즉시 실행)'}
                                onChange={(e) => setOrderPrice(e.target.value)}
                                className={`w-full p-2.5 bg-black/30 border rounded-lg font-mono font-bold outline-none transition-all focus:border-[#8a2be2] ${orderType !== 'MARKET' ? 'border-white/10 text-white' : 'border-white/5 text-slate-500 cursor-not-allowed opacity-50'}`}
                            />
                            <span className={`absolute right-3 font-bold ${orderType !== 'MARKET' ? 'text-slate-400' : 'text-slate-600'}`}>{fiat}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                            <label className="text-slate-400 uppercase text-[10px]">주문 수량</label>
                            <span className="text-[9px] text-[#00f2fe] font-bold">
                                주문가능: {!isAuthenticated ? '로그인 필요' : (selectedSide === 'BUY' ? `${balances[fiat].toLocaleString()} ${fiat}` : `${balances[coin].toLocaleString()} ${coin}`)}
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
    );
});
