import React, { useState } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { Coins, Search } from 'lucide-react';

export const WalletManagementTab: React.FC = () => {
    const {
        wallets,
        walletsSummary,
        fetchWallets,
        fetchWalletsSummary
    } = useExchangeStore();

    React.useEffect(() => {
        fetchWallets();
        fetchWalletsSummary();
    }, [fetchWallets, fetchWalletsSummary]);

    const [walletSearch, setWalletSearch] = useState('');
    const [walletPage, setWalletPage] = useState(0);

    const filteredWallets = wallets.filter(w => 
        w.email.toLowerCase().includes(walletSearch.toLowerCase()) || 
        w.currency.toLowerCase().includes(walletSearch.toLowerCase()) ||
        w.userId.toString().includes(walletSearch)
    );

    const WALLET_PAGE_SIZE = 20;
    const walletTotalPages = Math.ceil(filteredWallets.length / WALLET_PAGE_SIZE);
    const paginatedWallets = filteredWallets.slice(walletPage * WALLET_PAGE_SIZE, (walletPage + 1) * WALLET_PAGE_SIZE);

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                <Coins size={20} className="text-[#8a2be2]" />
                <span>거래소 전체 지갑 원장 관리</span>
            </div>

            {/* 자산별 유통 요약 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
                {walletsSummary.map(s => {
                    const total = s.totalBalance + s.totalLocked;

                    return (
                        <div key={s.currency} className="card-custom p-4 sm:p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-1.5">
                            <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-bold">거래소 내 총 보유 {s.currency}</div>
                            <div 
                                className="text-lg sm:text-xl xl:text-2xl font-black font-mono text-white mt-1 truncate" 
                                title={total.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            >
                                {total.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold border-t border-white/5 pt-2">
                                <span>가용: <span className="text-white">{s.totalBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>
                                <span>주문 대기: <span className="text-rose-400">{s.totalLocked.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span></span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 지갑 세부 목록 */}
            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                    <span className="text-sm font-bold text-white">개별 회원 보유 지갑 목록</span>
                    <div className="relative flex items-center">
                        <Search size={14} className="absolute left-3 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="이메일 또는 자산명 검색..." 
                            value={walletSearch}
                            onChange={(e) => {
                                setWalletSearch(e.target.value);
                                setWalletPage(0);
                            }}
                            className="pl-9 pr-4 py-2 bg-slate-950/50 border border-white/10 rounded-xl text-xs font-medium text-white outline-none w-[250px] focus:border-[#00f2fe] focus:shadow-[0_0_10px_rgba(0,242,254,0.15)] transition-all"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs font-medium">
                        <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-5 py-3">지갑 ID</th>
                                <th className="px-5 py-3">회원 UID</th>
                                <th className="px-5 py-3">이메일 계정</th>
                                <th className="px-5 py-3">통화 (Asset)</th>
                                <th className="px-5 py-3 text-right">보유 잔액 (Available)</th>
                                <th className="px-5 py-3 text-right">주문 락 잔액 (Locked)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredWallets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">지갑 데이터가 존재하지 않습니다.</td>
                                </tr>
                            ) : (
                                paginatedWallets.map(w => {
                                    const isKrw = w.currency === 'KRW';
                                    return (
                                        <tr key={w.walletId} className="hover:bg-white/2 transition-colors">
                                            <td className="px-5 py-4 font-mono text-slate-400">{w.walletId}</td>
                                            <td className="px-5 py-4 font-mono">{w.userId}</td>
                                            <td className="px-5 py-4 font-semibold text-white">{w.email}</td>
                                            <td className="px-5 py-4 font-bold text-white flex items-center gap-1.5">
                                                <span>{w.currency}</span>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isKrw ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                            </td>
                                            <td className="px-5 py-4 text-right font-bold font-mono text-slate-200">
                                                {w.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                            </td>
                                            <td className="px-5 py-4 text-right font-bold font-mono text-rose-400">
                                                {w.lockedBalance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 flex justify-between items-center border-t border-white/5 bg-black/10 text-xs">
                    <div className="text-slate-400">
                        Page <span className="text-white font-bold">{walletPage + 1}</span> of <span className="text-white font-bold">{walletTotalPages || 1}</span> (Total {filteredWallets.length} wallets)
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={walletPage === 0}
                            onClick={() => setWalletPage(prev => Math.max(prev - 1, 0))}
                            className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                        >
                            ◀ 이전
                        </button>
                        <button 
                            disabled={walletPage + 1 >= walletTotalPages}
                            onClick={() => setWalletPage(prev => Math.min(prev + 1, walletTotalPages - 1))}
                            className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                        >
                            다음 ▶
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
