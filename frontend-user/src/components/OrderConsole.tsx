import React from 'react';
import { Layers } from 'lucide-react';
import { useExchangeStore } from '../store/useExchangeStore';

interface OrderConsoleProps {
    /** 입력 폼에 바인딩된 지정가 주문 가격 */
    orderPrice: string;
    /** 주문 가격 상태 변경 핸들러 */
    setOrderPrice: (p: string) => void;
    /** 입력 폼에 바인딩된 주문 수량 */
    orderQty: string;
    /** 주문 수량 상태 변경 핸들러 */
    setOrderQty: (q: string) => void;
    /** 예약(스탑) 주문 조건 가격 */
    stopPrice: string;
    /** 예약 가격 상태 변경 핸들러 */
    setStopPrice: (p: string) => void;
    /** 선택한 주문 타입 (지정가, 시장가, 예약) */
    orderType: 'LIMIT' | 'MARKET' | 'STOP';
    /** 주문 타입 스위칭 핸들러 */
    setOrderType: (t: 'LIMIT' | 'MARKET' | 'STOP') => void;
    /** 매수(BUY) 또는 매도(SELL) 포지션 상태 */
    selectedSide: 'BUY' | 'SELL';
    /** 매수/매도 사이드 전환 핸들러 */
    setSelectedSide: (s: 'BUY' | 'SELL') => void;
    /** 사용자 자산 잔고 맵 */
    balances: { [key: string]: number };
    /** 세션 로그인 인증 완료 여부 */
    isAuthenticated: boolean;
    /** 주문 전송 서브밋 핸들러 */
    handleOrderSubmit: (e: React.FormEvent) => void;
    /** 화폐 단위 심볼 */
    fiat: string;
    /** 타겟 코인 심볼 */
    coin: string;
    /** 모바일 반응형 뷰 스위칭 탭 */
    mobileTab: string;
    /** 최소 주문 금액 제한 설정 */
    minAmt?: number;
}

/**
 * ⚡ 모의 주문 입력 콘솔 (OrderConsole) 컴포넌트
 * 
 * - 지정가(Limit), 시장가(Market), 예약(Stop-Limit) 주문 입력을 렌더링하고 유효성 제어를 담당함.
 * - React.memo를 사용하여 거래 입력에 필요한 정보가 변경되지 않을 때 불필요한 리렌더링을 차단함.
 */
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
    mobileTab,
    minAmt = 0
}) => {
    const scale = useExchangeStore(state => state.getScaleFactor());

    return (
        /* 모바일 탭 상태 분기에 따라 노출 여부 스위칭 */
        <div className={`${mobileTab === 'order' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl p-5 flex-col gap-4 order-2 lg:order-none`}>
            <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between items-center">
                <span className="flex items-center gap-2">
                    <Layers size={14} className="text-[#8a2be2]" />
                    모의 주문 콘솔
                </span>
            </div>
            
            {/* 매수 (BUY) / 매도 (SELL) 전격 전환 버튼 */}
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
                    {/* 주문 구분 선택 영역 */}
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

                    {/* 감시 가격 (STOP 주문 활성화 시에만 입력 허용) */}
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

                    {/* 주문 가격 (시장가 주문 시에는 자동으로 인풋 불필요/비활성화 처리) */}
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
                    {/* 주문 수량 및 가용 잔고 요약 */}
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
                                step={1 / scale}
                                value={orderQty}
                                onChange={(e) => setOrderQty(e.target.value)}
                                className="w-full p-2.5 bg-black/30 border border-white/10 rounded-lg text-white font-mono font-bold outline-none focus:border-[#8a2be2]"
                            />
                            <span className="absolute right-3 text-slate-400 font-bold">{coin}</span>
                        </div>
                    </div>

                    {/* 최종 주문 평가 금액 자동 계산 오버레이 */}
                    <div className="flex justify-between items-center bg-white/2 border border-white/5 rounded-xl p-3.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">주문 총액</span>
                        <span className="text-lg font-black font-mono text-[#00f2fe]">
                            {orderType === 'MARKET'
                                ? 'MARKET PRICE'
                                : `${((parseFloat(orderPrice) || 0) * (parseFloat(orderQty) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${fiat}`}
                        </span>
                    </div>

                    {minAmt > 0 && (
                        <div className="flex justify-between items-center px-1 text-[10px] text-slate-400 font-bold">
                            <span>최소 주문 금액:</span>
                            <span className="font-mono text-amber-400">
                                {minAmt.toLocaleString()} {fiat}
                            </span>
                        </div>
                    )}

                    {/* 주문 실행 및 최종 매칭엔진 전송 액션 단추 */}
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
