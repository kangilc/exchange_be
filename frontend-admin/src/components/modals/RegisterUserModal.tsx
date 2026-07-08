import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useExchangeStore } from '../../store/useExchangeStore';

interface RegisterUserModalProps {
    show: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const RegisterUserModal: React.FC<RegisterUserModalProps> = ({ show, onClose, onSuccess }) => {
    const registerUser = useExchangeStore(state => state.registerUser);
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regGrade, setRegGrade] = useState<'STANDARD' | 'VIP'>('STANDARD');

    const handleRegisterUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regEmail || !regPassword) {
            alert('이메일과 비밀번호를 입력해주세요.');
            return;
        }
        const ok = await registerUser(regEmail, regPassword, regGrade);
        if (ok) {
            alert('회원 계정이 개설되었으며, 기본 지갑이 자동으로 할당되었습니다.');
            setRegEmail('');
            setRegPassword('');
            setRegGrade('STANDARD');
            onSuccess();
        } else {
            alert('가입에 실패했습니다. 중복 계정인지 확인해주세요.');
        }
    };

    if (!show) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[480px] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <span className="text-sm font-extrabold text-white">신규 회원 계정 등록</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <form onSubmit={handleRegisterUser}>
                    <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">이메일 주소</label>
                            <input
                                type="email"
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                placeholder="example@exchange.com"
                                required
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">임시 비밀번호</label>
                            <input
                                type="password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="비밀번호 설정"
                                required
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none focus:border-[#8a2be2]"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">보안 등급</label>
                            <select
                                value={regGrade}
                                onChange={(e) => setRegGrade(e.target.value as any)}
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                            >
                                <option value="STANDARD">STANDARD (일반 등급)</option>
                                <option value="VIP">VIP (VIP 우대 등급)</option>
                            </select>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                        <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-bold shadow-lg hover:brightness-110">계정 개설</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

RegisterUserModal.displayName = 'RegisterUserModal';
