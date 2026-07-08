import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { User, Trade } from '../../types';

interface UserTradesModalProps {
    show: boolean;
    user: User | null;
    onClose: () => void;
}

export const UserTradesModal: React.FC<UserTradesModalProps> = ({ show, user, onClose }) => {
    const fetchUserTrades = useExchangeStore(state => state.fetchUserTrades);
    const getScaleFactor = useExchangeStore(state => state.getScaleFactor);
    const [userTrades, setUserTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (show && user) {
            const loadTrades = async () => {
                setIsLoading(true);
                const trades = await fetchUserTrades(user.userId);
                setUserTrades(trades || []);
                setIsLoading(false);
            };
            loadTrades();
        }
    }, [show, user, fetchUserTrades]);

    if (!show || !user) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[780px] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <span className="text-sm font-extrabold text-white">[{user.email}] 회원 실시간 거래 체결 내역</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                    <div className="max-h-[380px] overflow-y-auto border border-white/5 rounded-xl bg-slate-950/40">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-white/2 text-slate-400 font-bold border-b border-white/5">
                                <tr className="sticky top-0 bg-slate-950 z-10">
                                    <th className="px-4 py-3">체결 ID</th>
                                    <th className="px-4 py-3">심볼 (Symbol)</th>
                                    <th className="px-4 py-3">구분 (Side)</th>
                                    <th className="px-4 py-3 text-right">체결 가격</th>
                                    <th className="px-4 py-3 text-right">체결 수량</th>
                                    <th className="px-4 py-3 text-right">체결 대금</th>
                                    <th className="px-4 py-3 text-right">체결 시각</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-6 text-slate-500">거래 내역 조회 중...</td>
                                    </tr>
                                ) : userTrades.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-6 text-slate-500">체결된 거래 내역이 존재하지 않습니다.</td>
                                    </tr>
                                ) : (
                                    userTrades.map((t: Trade) => {
                                        const isBuy = t.side === 'BUY';
                                        const scale = getScaleFactor(t.symbol);
                                        const displayPrice = t.price / scale;
                                        const displayVolume = t.qty * (displayPrice);
                                        const unit = t.symbol === 'BTC-USD' ? '$' : '₩';

                                        return (
                                            <tr key={t.tradeId} className="text-slate-300">
                                                <td className="px-4 py-3 font-mono font-bold text-[#00f2fe]">{t.tradeId}</td>
                                                <td className="px-4 py-3 font-bold text-white">{t.symbol}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                        {isBuy ? '매수 (BUY)' : '매도 (SELL)'}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold font-mono ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {unit}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold font-mono">{t.qty.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right font-bold font-mono text-slate-100">
                                                    {unit}{displayVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-400">{new Date(t.executedAt).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-white/5 flex justify-end bg-white/2">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10">닫기</button>
                </div>
            </div>
        </div>
    );
};

UserTradesModal.displayName = 'UserTradesModal';
