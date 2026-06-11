import React, { useState, useEffect } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { ShieldAlert, Search } from 'lucide-react';

export const LedgerHistoryTab: React.FC = () => {
    const {
        ledgerList,
        ledgerTotalPages,
        ledgerTotalCount,
        fetchLedgerList,
        adjustUserAsset
    } = useExchangeStore();

    // Local injection states
    const [manualUserId, setManualUserId] = useState('');
    const [manualCurrency, setManualCurrency] = useState('KRW');
    const [manualType, setManualType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
    const [manualAmount, setManualAmount] = useState('');

    // Local search states
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerPage, setLedgerPage] = useState(0);

    useEffect(() => {
        setLedgerPage(0);
        fetchLedgerList(0, 10, ledgerSearch);
    }, [ledgerSearch]);

    const handleManualInjection = async (e: React.FormEvent) => {
        e.preventDefault();
        const uId = parseInt(manualUserId);
        const amountVal = parseFloat(manualAmount);
        if (isNaN(uId) || isNaN(amountVal) || amountVal <= 0) {
            alert('UID와 금액을 정확히 입력해주세요.');
            return;
        }
        const finalAmount = manualType === 'WITHDRAWAL' ? -amountVal : amountVal;
        const ok = await adjustUserAsset(uId, manualCurrency, finalAmount);
        if (ok) {
            alert('입출금 원장 갱신 및 실시간 인젝션이 성공적으로 처리되었습니다.');
            setManualUserId('');
            setManualAmount('');
            fetchLedgerList(ledgerPage, 10, ledgerSearch);
        } else {
            alert('인젝션 처리에 실패하였습니다. 유효한 UID인지 확인해주세요.');
        }
    };

    const handlePageChange = (newPage: number) => {
        setLedgerPage(newPage);
        fetchLedgerList(newPage, 10, ledgerSearch);
    };

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-[#8a2be2]" />
                <span>거래소 입출금 원장 통합 관리</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* 즉시 입출금 폼 */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex justify-between">
                        <span>수동 입출금 즉시 인젝션</span>
                        <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 rounded uppercase font-bold tracking-wider">Admin Settle</span>
                    </div>
                    <form onSubmit={handleManualInjection} className="flex flex-col gap-4 text-xs font-semibold">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">수신 회원 UID</label>
                            <input 
                                type="number" 
                                value={manualUserId}
                                onChange={(e) => setManualUserId(e.target.value)}
                                placeholder="회원 UID 번호를 입력해주세요."
                                className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-mono font-bold outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">대상 자산 (Asset)</label>
                            <select 
                                value={manualCurrency}
                                onChange={(e) => setManualCurrency(e.target.value)}
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
                            <label className="text-slate-400 uppercase text-[10px]">조작 구분 (Type)</label>
                            <select 
                                value={manualType}
                                onChange={(e) => setManualType(e.target.value as any)}
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none"
                            >
                                <option value="DEPOSIT">DEPOSIT (자산 추가 지급)</option>
                                <option value="WITHDRAWAL">WITHDRAWAL (자산 차감/회수)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">조작 수량 (Amount)</label>
                            <input 
                                type="number" 
                                step="any"
                                value={manualAmount}
                                onChange={(e) => setManualAmount(e.target.value)}
                                placeholder="조작할 액수 또는 코인 개수를 입력해 주세요."
                                className="w-full p-3 bg-black/30 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full py-3 bg-gradient-to-r from-[#8a2be2] to-[#6366f1] rounded-xl font-bold text-white shadow-lg hover:scale-[1.01] transition-all mt-2"
                        >
                            💸 입출금 원장 즉시 반영
                        </button>
                    </form>
                </div>

                {/* 전체 입출금 감사 원장 테이블 */}
                <div className="xl:col-span-2 bg-[#0a1020]/45 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-white/5 flex justify-between items-center">
                        <span className="text-sm font-bold text-white">거래소 전체 입출금 이력 (감사 원장)</span>
                        <div className="relative flex items-center">
                            <Search size={14} className="absolute left-3 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="이메일 검색..." 
                                value={ledgerSearch}
                                onChange={(e) => {
                                    setLedgerSearch(e.target.value);
                                }}
                                className="pl-9 pr-4 py-2 bg-slate-950/50 border border-white/10 rounded-xl text-xs font-medium text-white outline-none w-[250px] focus:border-[#00f2fe] transition-all"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs font-medium">
                            <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-3">원장 ID</th>
                                    <th className="px-5 py-3">회원 UID</th>
                                    <th className="px-5 py-3">이메일 계정</th>
                                    <th className="px-5 py-3">통화</th>
                                    <th className="px-5 py-3">구분</th>
                                    <th className="px-5 py-3 text-right">금액</th>
                                    <th className="px-5 py-3 text-right">적용 시각</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {ledgerList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-slate-500">입출금 이력이 존재하지 않습니다.</td>
                                    </tr>
                                ) : (
                                    ledgerList.map((l: any) => (
                                        <tr key={l.ledgerId} className="hover:bg-white/2 transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-slate-400">{l.ledgerId}</td>
                                            <td className="px-5 py-3.5 font-mono">{l.userId}</td>
                                            <td className="px-5 py-3.5 font-semibold text-white">{l.email || 'Unknown'}</td>
                                            <td className="px-5 py-3.5 font-bold text-white">{l.currency}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${l.type === 'DEPOSIT' ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                    {l.type}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-3.5 text-right font-bold font-mono ${l.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {parseFloat(l.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 flex justify-between items-center border-t border-white/5 bg-black/10 text-xs">
                        <div className="text-slate-400">
                            Page <span className="text-white font-bold">{ledgerPage + 1}</span> of <span className="text-white font-bold">{ledgerTotalPages || 1}</span> (Total {ledgerTotalCount} items)
                        </div>
                        <div className="flex gap-2">
                            <button 
                                disabled={ledgerPage === 0}
                                onClick={() => handlePageChange(Math.max(ledgerPage - 1, 0))}
                                className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                            >
                                ◀ 이전
                            </button>
                            <button 
                                disabled={ledgerPage + 1 >= ledgerTotalPages}
                                onClick={() => handlePageChange(Math.min(ledgerPage + 1, ledgerTotalPages - 1))}
                                className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                            >
                                다음 ▶
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
