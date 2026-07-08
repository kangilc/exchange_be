import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useExchangeStore } from '../../store/useExchangeStore';
import type {User, LedgerEntry} from '../../types'; // 공통 타입 import
// 공통 타입 import

interface AdjustAssetModalProps {
    show: boolean;
    user: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const AdjustAssetModal: React.FC<AdjustAssetModalProps> = ({ show, user, onClose, onSuccess }) => {
    const adjustUserAsset = useExchangeStore(state => state.adjustUserAsset);
    const fetchUserLedgers = useExchangeStore(state => state.fetchUserLedgers);

    const [adjustCurrency, setAdjustCurrency] = useState('KRW');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustType, setAdjustType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
    const [userLedgerHistory, setUserLedgerHistory] = useState<LedgerEntry[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (show && user) {
            const loadLedgerHistory = async () => {
                setIsLoadingHistory(true);
                const history = await fetchUserLedgers(user.userId);
                setUserLedgerHistory(history || []);
                setIsLoadingHistory(false);
            };
            loadLedgerHistory();
            
            // Reset form fields when modal opens
            setAdjustCurrency('KRW');
            setAdjustAmount('');
            setAdjustType('DEPOSIT');
        }
    }, [show, user, fetchUserLedgers]);

    const handleAdjustAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const amountNum = parseFloat(adjustAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('올바른 금액을 입력해 주세요.');
            return;
        }

        const actualAmount = adjustType === 'DEPOSIT' ? amountNum : -amountNum;
        const ok = await adjustUserAsset(user.userId, adjustCurrency, actualAmount);
        if (ok) {
            alert('회원 자산 정보가 원장에 정상 가감 반영되었습니다.');
            onSuccess();
        } else {
            alert('자산 조작 처리에 실패했습니다. 잔고가 부족하거나 서버 에러일 수 있습니다.');
        }
    };

    if (!show || !user) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0d1426] border border-emerald-500/40 rounded-2xl w-[520px] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <span className="text-sm font-extrabold text-white">회원 자산 인젝션 및 차감 (자산 관리)</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <form onSubmit={handleAdjustAsset}>
                    <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">회원 이메일 계정</label>
                            <input
                                type="text"
                                value={user.email}
                                disabled
                                className="w-full p-3 bg-slate-950/50 border border-white/5 rounded-lg text-slate-400 outline-none cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-400 uppercase text-[10px]">통화 (Asset)</label>
                                <select
                                    value={adjustCurrency}
                                    onChange={(e) => setAdjustCurrency(e.target.value)}
                                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                                >
                                    <option value="KRW">KRW (대한민국 원화)</option>
                                    <option value="USD">USD (미국 달러)</option>
                                    <option value="BTC">BTC (비트코인)</option>
                                    <option value="ADA">ADA (에이다)</option>
                                    <option value="JAF">JAF (자바에프)</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-400 uppercase text-[10px]">조작 유형</label>
                                <select
                                    value={adjustType}
                                    onChange={(e) => setAdjustType(e.target.value as any)}
                                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                                >
                                    <option value="DEPOSIT">DEPOSIT (자산 추가 지급)</option>
                                    <option value="WITHDRAWAL">WITHDRAWAL (자산 차감/회수)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">조작 금액 (Amount)</label>
                            <input
                                type="number"
                                step="any"
                                value={adjustAmount}
                                onChange={(e) => setAdjustAmount(e.target.value)}
                                placeholder={adjustType === 'DEPOSIT' ? '지급할 액수 입력 (예: 50000)' : '차감할 액수 입력 (양수로 입력 - 예: 2000)'}
                                required
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <label className="text-slate-400 uppercase text-[10px]">최근 입출금 감사 이력</label>
                            <div className="max-h-[160px] overflow-y-auto border border-white/5 rounded-xl bg-slate-950/40">
                                <table className="w-full text-left text-[11px]">
                                    <thead className="bg-white/2 text-slate-400 font-bold border-b border-white/5">
                                        <tr>
                                            <th className="px-3 py-2">일시</th>
                                            <th className="px-3 py-2">유형</th>
                                            <th className="px-3 py-2">통화</th>
                                            <th className="px-3 py-2 text-right">금액</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {isLoadingHistory ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-4 text-slate-500">이력 조회 중...</td>
                                            </tr>
                                        ) : userLedgerHistory.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="text-center py-4 text-slate-500">입출금 이력이 존재하지 않습니다.</td>
                                            </tr>
                                        ) : (
                                            userLedgerHistory.map((l: LedgerEntry, idx: number) => (
                                                <tr key={idx} className="text-slate-300">
                                                    <td className="px-3 py-2 text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${l.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                            {l.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 font-bold">{l.currency}</td>
                                                    <td className={`px-3 py-2 text-right font-bold font-mono ${parseFloat(l.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {parseFloat(l.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                        <button type="submit" className="px-5 py-2 rounded-lg bg-emerald-500 text-white font-bold shadow-lg hover:brightness-110">자산 원장 갱신</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

AdjustAssetModal.displayName = 'AdjustAssetModal';
