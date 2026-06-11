import React from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { LayoutDashboard, Activity } from 'lucide-react';

interface DashboardTabProps {
    setActiveTab: (tab: 'dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger' | 'settings' | 'custody' | 'performance') => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ setActiveTab }) => {
    const {
        users,
        totalTradesCount,
        lastPrice,
        activeSymbol,
        walletsSummary,
        fetchUsers,
        fetchWalletsSummary,
        fetchSummaryStats
    } = useExchangeStore();

    React.useEffect(() => {
        fetchUsers();
        fetchWalletsSummary();
        fetchSummaryStats();
    }, [fetchUsers, fetchWalletsSummary, fetchSummaryStats]);

    const formatPrice = (val: number) => {
        const unit = activeSymbol === 'BTC-USD' ? '$' : '₩';
        return `${unit}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // 전일 대비 모의 변동량 산정
    const getChange24h = () => {
        const base = activeSymbol === 'BTC-USD' ? 65000 : 500;
        const diff = lastPrice - base;
        const pct = (diff / base) * 100;
        const sign = diff >= 0 ? '+' : '';
        const unit = activeSymbol === 'BTC-USD' ? '$' : '₩';
        return {
            text: `${sign}${pct.toFixed(2)}% (${sign}${unit}${Math.abs(diff).toLocaleString()})`,
            isUp: diff >= 0
        };
    };

    const change24h = getChange24h();

    // 전체 유통 자산 비례 게이지 계산
    const getMaxBalance = () => {
        if (!walletsSummary || walletsSummary.length === 0) return 1;
        return Math.max(...walletsSummary.map(s => s.totalBalance + s.totalLocked));
    };
    const maxBalance = getMaxBalance();

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                <LayoutDashboard size={20} className="text-[#8a2be2]" />
                <span>종합 데이터 대시보드</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card-custom p-4 sm:p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">전체 등록 회원</div>
                        <div className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-white mt-1 whitespace-nowrap">{users.length} 명</div>
                    </div>
                    <div className="text-[10px] text-slate-400">실시간 등록 회원 원장 수</div>
                </div>

                <div className="card-custom p-4 sm:p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">누적 체결 거래 수</div>
                        <div className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-[#00f2fe] mt-1 whitespace-nowrap">{totalTradesCount} 건</div>
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <Activity size={10} />
                        <span>WebSocket 수신 실황</span>
                    </div>
                </div>

                <div className="card-custom p-4 sm:p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">감시 마켓 현재가</div>
                        <div className="text-xl sm:text-2xl xl:text-3xl font-black font-mono text-white mt-1 whitespace-nowrap">{lastPrice > 0 ? formatPrice(lastPrice) : '-'}</div>
                    </div>
                    <div className="text-[10px] text-slate-400">{activeSymbol} 시황 데이터</div>
                </div>

                <div className="card-custom p-4 sm:p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">24H 등락폭</div>
                        <div className={`text-sm sm:text-base xl:text-lg font-black font-mono mt-1 whitespace-nowrap ${change24h.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {lastPrice > 0 ? change24h.text : '-'}
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400">전일 종가 대비 등락 추이</div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* 거래소 통화별 자산 요약 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">거래소 통화별 총 유통 자산 지표</div>
                    <div className="flex flex-col gap-4">
                        {walletsSummary.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-xs">보유 자산 내역을 불러오는 중...</div>
                        ) : (
                            walletsSummary.map(s => {
                                const total = s.totalBalance + s.totalLocked;
                                const lockedPct = total > 0 ? (s.totalLocked / total) * 100 : 0;
                                const scaleWidth = maxBalance > 0 ? (total / maxBalance) * 100 : 0;
                                const isKrw = s.currency === 'KRW';

                                return (
                                    <div key={s.currency} className="flex flex-col gap-1 text-xs">
                                        <div className="flex justify-between font-bold">
                                            <span className="text-slate-200 flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isKrw ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                {s.currency}
                                            </span>
                                            <span className="text-slate-400">
                                                총합: <span className="text-white">{total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span> {s.currency} 
                                                <span className="text-rose-400 ml-1.5 text-[10px] font-mono">(주문 대기: {s.totalLocked.toLocaleString(undefined, { maximumFractionDigits: 4 })} / {lockedPct.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-950 rounded overflow-hidden">
                                            <div 
                                                className={`h-full rounded transition-all duration-500 ${isKrw ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`} 
                                                style={{ width: `${Math.max(scaleWidth, 4)}%` }} 
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 신규 가입자 목록 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-sm font-extrabold text-white">최근 신규 가입 회원</span>
                        <button onClick={() => setActiveTab('users')} className="text-[10px] text-[#00f2fe] font-bold hover:underline">회원 관리 이동 &gt;</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="text-slate-400 font-bold border-b border-white/5">
                                    <th className="py-2">이메일 계정</th>
                                    <th className="py-2">등급</th>
                                    <th className="py-2">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {users.slice(0, 5).map(u => (
                                    <tr key={u.userId} className="text-slate-300">
                                        <td className="py-2.5 font-semibold">{u.email}</td>
                                        <td className="py-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${u.grade === 'VIP' ? 'bg-amber-500/10 border border-amber-500/35 text-amber-400' : 'bg-slate-500/10 border border-slate-500/35 text-slate-400'}`}>
                                                {u.grade}
                                            </span>
                                        </td>
                                        <td className="py-2.5">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${u.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
