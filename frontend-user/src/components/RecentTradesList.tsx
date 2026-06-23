import React, { useMemo } from 'react';
import { useExchangeStore } from '../store/useExchangeStore';

interface RecentTradesListProps {
    mobileTab: string;
}

export const RecentTradesList: React.FC<RecentTradesListProps> = React.memo(({ mobileTab }) => {
    const activeSymbol = useExchangeStore(state => state.activeSymbol);
    const tradesLog = useExchangeStore(state => state.tradesLog);

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

    return (
        <div className={`${mobileTab === 'trades' ? 'flex' : 'hidden'} lg:flex bg-[#0a1020]/45 border border-white/5 rounded-2xl flex-col flex-1 overflow-hidden h-[400px] lg:h-auto`}>
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
    );
});
