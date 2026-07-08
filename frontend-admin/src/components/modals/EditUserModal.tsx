import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useExchangeStore } from '../../store/useExchangeStore';
import type {User} from '../../types'; // 공통 타입 import
// 공통 타입 import

interface EditUserModalProps {
    show: boolean;
    user: User | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ show, user, onClose, onSuccess }) => {
    const updateUser = useExchangeStore(state => state.updateUser);

    const [editGrade, setEditGrade] = useState<User['grade']>('STANDARD');
    const [editStatus, setEditStatus] = useState<User['status']>('ACTIVE');

    useEffect(() => {
        if (user) {
            setEditGrade(user.grade);
            setEditStatus(user.status);
        }
    }, [user]);

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const ok = await updateUser(user.userId, user.email, editGrade, editStatus);
        if (ok) {
            alert('회원 상태 및 등급이 정상 변경되었습니다.');
            onSuccess();
        } else {
            alert('정보 수정에 실패했습니다.');
        }
    };

    if (!show || !user) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[480px] shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                    <span className="text-sm font-extrabold text-white">회원 상세 정보 수정</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
                <form onSubmit={handleUpdateUser}>
                    <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">회원 이메일</label>
                            <input
                                type="email"
                                value={user.email}
                                disabled
                                className="w-full p-3 bg-slate-950/50 border border-white/5 rounded-lg text-slate-400 outline-none cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">원장 거래 상태</label>
                            <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as User['status'])}
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                            >
                                <option value="ACTIVE">ACTIVE (거래 가능)</option>
                                <option value="PENDING">PENDING (승인 대기)</option>
                                <option value="SUSPENDED">SUSPENDED (거래정지)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">보안 등급</label>
                            <select
                                value={editGrade}
                                onChange={(e) => setEditGrade(e.target.value as User['grade'])}
                                className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                            >
                                <option value="STANDARD">STANDARD (일반 등급)</option>
                                <option value="VIP">VIP (VIP 우대 등급)</option>
                            </select>
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                        <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-bold shadow-lg hover:brightness-110">정보 변경</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

EditUserModal.displayName = 'EditUserModal';
