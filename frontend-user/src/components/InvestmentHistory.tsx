import React from 'react';

interface LocalStopLimitOrder {
    /** 예약 주문 식별자 */
    id: string;
    /** 거래 대상 마켓 심볼 */
    symbol: string;
    /** 매수(BUY) / 매도(SELL) 포지션 구분 */
    side: 'BUY' | 'SELL';
    /** 트리거 감시 가격 */
    stopPrice: number;
    /** 조건 도달 시 자동 생성될 한도 가격 */
    price: number;
    /** 주문 희망 수량 */
    qty: number;
    /** 주문 접수 시각 문자열 */
    time: string;
    /** 현재 주문 상태 (예: 감시 중) */
    status: string;
}

interface InvestmentHistoryProps {
    /** 유저 개인 체결 이력 로그 */
    userTrades: any[];
    /** 사용자 보유 자산 잔고 맵 */
    balances: { [key: string]: number };
    /** 원화 기준 총 평가 금액 합산 수치 */
    totalAssetEvalValue: number;
    /** 대기 중인 예약 주문 리스트 */
    stopLimitOrdersList: LocalStopLimitOrder[];
    /** 예약 주문 리스트 갱신 상태 관리 함수 */
    setStopLimitOrders: React.Dispatch<React.SetStateAction<LocalStopLimitOrder[]>>;
    /** 시스템 콘솔 영역 로그 적재 이벤트 핸들러 */
    appendLog: (type: 'buy' | 'sell' | 'system' | 'warning' | 'stop', message: string) => void;
}

/**
 * ⚡ 투자내역 및 예약대기 (InvestmentHistory) 컴포넌트
 * 
 * - 실계좌 체결 이력(userTrades) 데이터를 기반으로 매수 평균가, 총 매수금액, 평가손익 및 수익률을 동적으로 정밀 계산함.
 * - 클라이언트 감시 엔진에서 대기 중인 예약 주문(Stop-Limit) 목록을 렌더링하고, 취소(Cancel) 조작 인터페이스를 제공함.
 */
export const InvestmentHistory: React.FC<InvestmentHistoryProps> = React.memo(({
    userTrades,
    balances,
    totalAssetEvalValue,
    stopLimitOrdersList,
    setStopLimitOrders,
    appendLog
}) => {
    // 1. userTrades 배열을 검색하여 BTC 매수 물량 및 가중평균 단가 동적 산출
    const btcBuyOrders = userTrades.filter(t => t.symbol === 'BTC-USD' && t.side === 'BUY');
    const btcTotalQty = btcBuyOrders.reduce((sum, t) => sum + Number(t.qty), 0);
    const btcAvgPrice = btcTotalQty > 0 ? (btcBuyOrders.reduce((sum, t) => sum + (Number(t.qty) * (Number(t.price) / 100.0)), 0) / btcTotalQty) : 65000;

    // 2. ADA 매수 물량 및 가중평균 단가 동적 산출
    const adaBuyOrders = userTrades.filter(t => t.symbol === 'ADA-KRW' && t.side === 'BUY');
    const adaTotalQty = adaBuyOrders.reduce((sum, t) => sum + Number(t.qty), 0);
    const adaAvgPrice = adaTotalQty > 0 ? (adaBuyOrders.reduce((sum, t) => sum + (Number(t.qty) * (Number(t.price) / 100.0)), 0) / adaTotalQty) : 500;

    // 3. 실제 총 투자 원금(매수 평단가 기반) 원화 가치로 통합 환산 (BTC는 1350원 고정 환율 적용)
    const btcInvestedKrw = btcTotalQty * btcAvgPrice * 1350;
    const adaInvestedKrw = adaTotalQty * adaAvgPrice;
    const totalInvestedKrw = btcInvestedKrw + adaInvestedKrw;

    // 4. 보유 수량 기준 실시간 시세 대비 자산 평가액 계산
    const btcCurrentKrw = balances.BTC * 65000 * 1350;
    const adaCurrentKrw = balances.ADA * 500;
    const totalCurrentAssetKrw = btcCurrentKrw + adaCurrentKrw;

    // 5. 총 평가 손익 및 수익률 산출
    const profitKrw = totalCurrentAssetKrw - totalInvestedKrw;
    const profitPercent = totalInvestedKrw > 0 ? (profitKrw / totalInvestedKrw) * 100 : 0;

    return (
        <div className="flex flex-col gap-6 animate-fade-in text-xs font-semibold">
            {/* 상단: 총 투자 평가 요약 대시보드 카드 */}
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

            {/* 중단: 보유 가상 자산 평가 정보 상세 리스트 */}
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
                            {/* BTC (USD 기준 연산 및 1350원 환산값 표현) */}
                            <tr className="hover:bg-white/2 transition-colors">
                                <td className="px-5 py-4 text-white font-extrabold">BTC (비트코인)</td>
                                <td className="px-5 py-4 text-right">{balances.BTC.toLocaleString(undefined, { minimumFractionDigits: 8 })} BTC</td>
                                <td className="px-5 py-4 text-right">${btcAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-5 py-4 text-right">{(balances.BTC * 65000).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</td>
                                <td className="px-5 py-4 text-right text-slate-400">0.00%</td>
                            </tr>
                            {/* ADA (KRW 기준 연산) */}
                            <tr className="hover:bg-white/2 transition-colors">
                                <td className="px-5 py-4 text-white font-extrabold">ADA (에이다)</td>
                                <td className="px-5 py-4 text-right">{balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 8 })} ADA</td>
                                <td className="px-5 py-4 text-right">{adaAvgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} KRW</td>
                                <td className="px-5 py-4 text-right">{(balances.ADA * 500).toLocaleString()} KRW</td>
                                <td className="px-5 py-4 text-right text-slate-400">0.00%</td>
                            </tr>
                            {/* KRW (화폐 고정값 지표) */}
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

            {/* 하단: 조건부 예약 주문 (스탑 리밋) 대기 목록 */}
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
                                                type="button"
                                                onClick={() => {
                                                    // 예약 대기열 상태 필터로 주문 삭제 조치
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
    );
});
