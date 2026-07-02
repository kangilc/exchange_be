import React, { useState } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { Users, Plus, Search, X } from 'lucide-react';

export const UserManagementTab: React.FC = () => {
    const {
        users,
        registerUser,
        updateUser,
        adjustUserAsset,
        fetchUsers,
        fetchUserLedgers,
        fetchUserTrades,
        getScaleFactor
    } = useExchangeStore();

    React.useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Local filter/search states
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(0);

    // Register User Modal States
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regGrade, setRegGrade] = useState<'STANDARD' | 'VIP'>('STANDARD');

    // Edit User Modal States
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [editTargetUser, setEditTargetUser] = useState<any>(null);
    const [editGrade, setEditGrade] = useState<any>('STANDARD');
    const [editStatus, setEditStatus] = useState<any>('ACTIVE');

    // Adjust Asset Modal States
    const [showAdjustAssetModal, setShowAdjustAssetModal] = useState(false);
    const [adjustTargetUser, setAdjustTargetUser] = useState<any>(null);
    const [adjustCurrency, setAdjustCurrency] = useState('KRW');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustType, setAdjustType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');

    // User Trades Modal States
    const [showUserTradesModal, setShowUserTradesModal] = useState(false);
    const [tradeTargetUser, setTradeTargetUser] = useState<any>(null);

    // Local lists for modals
    const [userLedgerHistory, setUserLedgerHistory] = useState<any[]>([]);
    const [userTrades, setUserTrades] = useState<any[]>([]);

    // Helper functions
    const handleRegisterUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regEmail || !regPassword) {
            alert('이메일과 비밀번호를 입력해주세요.');
            return;
        }
        const ok = await registerUser(regEmail, regPassword, regGrade);
        if (ok) {
            alert('회원 계정이 개설되었으며, 기본 지갑이 자동으로 할당되었습니다.');
            setShowRegisterModal(false);
            setRegEmail('');
            setRegPassword('');
            setRegGrade('STANDARD');
            fetchUsers();
        } else {
            alert('가입에 실패했습니다. 중복 계정인지 확인해주세요.');
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTargetUser) return;
        const ok = await updateUser(editTargetUser.userId, editTargetUser.email, editGrade, editStatus);
        if (ok) {
            alert('회원 상태 및 등급이 정상 변경되었습니다.');
            setShowEditUserModal(false);
            fetchUsers();
        } else {
            alert('정보 수정에 실패했습니다.');
        }
    };

    const handleApproveUser = async (user: any) => {
        if (!window.confirm(`${user.email} 회원의 가입 신청을 승인하시겠습니까?`)) return;
        const ok = await updateUser(user.userId, user.email, user.grade, 'ACTIVE');
        if (ok) {
            alert('회원 가입 승인이 완료되었습니다.');
            fetchUsers();
        } else {
            alert('가입 승인 처리에 실패했습니다.');
        }
    };

    const handleAdjustAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustTargetUser) return;
        const amountNum = parseFloat(adjustAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert('올바른 금액을 입력해 주세요.');
            return;
        }

        const actualAmount = adjustType === 'DEPOSIT' ? amountNum : -amountNum;
        const ok = await adjustUserAsset(adjustTargetUser.userId, adjustCurrency, actualAmount);
        if (ok) {
            alert('회원 자산 정보가 원장에 정상 가감 반영되었습니다.');
            setShowAdjustAssetModal(false);
            setAdjustAmount('');
            fetchUsers();
        } else {
            alert('자산 조작 처리에 실패했습니다. 잔고가 부족하거나 서버 에러일 수 있습니다.');
        }
    };

    const openAssetModal = async (user: any) => {
        setAdjustTargetUser(user);
        setAdjustCurrency('KRW');
        setAdjustAmount('');
        setAdjustType('DEPOSIT');
        const history = await fetchUserLedgers(user.userId);
        setUserLedgerHistory(history);
        setShowAdjustAssetModal(true);
    };

    const openTradesModal = async (user: any) => {
        setTradeTargetUser(user);
        const trades = await fetchUserTrades(user.userId);
        setUserTrades(trades);
        setShowUserTradesModal(true);
    };

    // Filtered & Paginated Users
    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    );
    const USER_PAGE_SIZE = 10;
    const userTotalPages = Math.ceil(filteredUsers.length / USER_PAGE_SIZE);
    const paginatedUsers = filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE);

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="section-title text-xl font-black text-white flex items-center gap-2">
                    <Users size={20} className="text-[#8a2be2]" />
                    <span>회원 통합 관리 원장</span>
                </div>
                <button 
                    onClick={() => setShowRegisterModal(true)}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#8a2be2] to-[#6366f1] shadow-[0_4px_15px_rgba(138,43,226,0.3)] hover:scale-[1.02] transition-all"
                >
                    <Plus size={14} />
                    <span>신규 회원 등록</span>
                </button>
            </div>

            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                    <span className="text-sm font-bold text-white">등록 회원 상세 목록</span>
                    <div className="relative flex items-center">
                        <Search size={14} className="absolute left-3 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="이메일 검색..." 
                            value={userSearch}
                            onChange={(e) => {
                                setUserSearch(e.target.value);
                                setUserPage(0);
                            }}
                            className="pl-9 pr-4 py-2 bg-slate-950/50 border border-white/10 rounded-xl text-xs font-medium text-white outline-none w-[250px] focus:border-[#00f2fe] focus:shadow-[0_0_10px_rgba(0,242,254,0.15)] transition-all"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs font-medium">
                        <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-5 py-3">UID</th>
                                <th className="px-5 py-3">이메일 계정</th>
                                <th className="px-5 py-3">보안 등급</th>
                                <th className="px-5 py-3">원장 상태</th>
                                <th className="px-5 py-3">가입 일시</th>
                                <th className="px-5 py-3 text-right">원장 조작</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">가입된 회원이 존재하지 않습니다.</td>
                                </tr>
                            ) : (
                                paginatedUsers.map(u => (
                                    <tr key={u.userId} className="hover:bg-white/2 transition-colors">
                                        <td className="px-5 py-4 font-mono font-bold text-[#00f2fe]">{u.userId}</td>
                                        <td className="px-5 py-4 font-semibold text-white">{u.email}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${u.grade === 'VIP' ? 'bg-amber-500/10 border border-amber-500/35 text-amber-400' : 'bg-slate-500/10 border border-slate-500/35 text-slate-400'}`}>
                                                {u.grade}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${u.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : u.status === 'PENDING' ? 'bg-amber-500/10 border border-amber-500/35 text-amber-400 animate-pulse' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-slate-400">{new Date(u.createdAt).toLocaleString()}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-end gap-2 text-[10px] font-bold">
                                                {u.status === 'PENDING' && (
                                                    <button 
                                                        onClick={() => handleApproveUser(u)}
                                                        className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all font-black"
                                                    >
                                                        ✔️ 가입 승인
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => openAssetModal(u)}
                                                    className="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/12 transition-all"
                                                >
                                                    💸 자산 관리
                                                </button>
                                                <button 
                                                    onClick={() => openTradesModal(u)}
                                                    className="px-3 py-1.5 rounded-lg border border-[#8a2be2]/25 bg-[#8a2be2]/5 text-[#c084fc] hover:bg-[#8a2be2]/12 transition-all"
                                                >
                                                    📈 거래 내역
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setEditTargetUser(u);
                                                        setEditGrade(u.grade);
                                                        setEditStatus(u.status);
                                                        setShowEditUserModal(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                                                >
                                                    ⚙️ 정보 수정
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 flex justify-between items-center border-t border-white/5 bg-black/10 text-xs">
                    <div className="text-slate-400">
                        Page <span className="text-white font-bold">{userPage + 1}</span> of <span className="text-white font-bold">{userTotalPages || 1}</span> (Total {filteredUsers.length} users)
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={userPage === 0}
                            onClick={() => setUserPage(prev => Math.max(prev - 1, 0))}
                            className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                        >
                            ◀ 이전
                        </button>
                        <button 
                            disabled={userPage + 1 >= userTotalPages}
                            onClick={() => setUserPage(prev => Math.min(prev + 1, userTotalPages - 1))}
                            className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                        >
                            다음 ▶
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal 1: Register User */}
            {showRegisterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[480px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">신규 회원 계정 등록</span>
                            <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
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
                                <button type="button" onClick={() => setShowRegisterModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                                <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-bold shadow-lg hover:brightness-110">계정 개설</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Edit User Grade/Status */}
            {showEditUserModal && editTargetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[480px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">회원 상세 정보 수정</span>
                            <button onClick={() => setShowEditUserModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleUpdateUser}>
                            <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">회원 이메일</label>
                                    <input 
                                        type="email" 
                                        value={editTargetUser.email}
                                        disabled
                                        className="w-full p-3 bg-slate-950/50 border border-white/5 rounded-lg text-slate-400 outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">원장 거래 상태</label>
                                    <select 
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value as any)}
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
                                        onChange={(e) => setEditGrade(e.target.value as any)}
                                        className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                                    >
                                        <option value="STANDARD">STANDARD (일반 등급)</option>
                                        <option value="VIP">VIP (VIP 우대 등급)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/2">
                                <button type="button" onClick={() => setShowEditUserModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                                <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-bold shadow-lg hover:brightness-110">정보 변경</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 3: Adjust User Assets */}
            {showAdjustAssetModal && adjustTargetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0d1426] border border-emerald-500/40 rounded-2xl w-[520px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">회원 자산 인젝션 및 차감 (자산 관리)</span>
                            <button onClick={() => setShowAdjustAssetModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleAdjustAsset}>
                            <div className="p-6 flex flex-col gap-4 text-xs font-semibold">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">회원 이메일 계정</label>
                                    <input 
                                        type="text" 
                                        value={adjustTargetUser.email}
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
                                                {userLedgerHistory.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-4 text-slate-500">입출금 이력이 존재하지 않습니다.</td>
                                                    </tr>
                                                ) : (
                                                    userLedgerHistory.map((l: any, idx: number) => (
                                                        <tr key={idx} className="text-slate-300">
                                                            <td className="px-3 py-2 text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${l.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                                    {l.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 font-bold">{l.currency}</td>
                                                            <td className={`px-3 py-2 text-right font-bold font-mono ${l.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                                <button type="button" onClick={() => setShowAdjustAssetModal(false)} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 font-bold hover:bg-white/5">취소</button>
                                <button type="submit" className="px-5 py-2 rounded-lg bg-emerald-500 text-white font-bold shadow-lg hover:brightness-110">자산 원장 갱신</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 4: User Trade History */}
            {showUserTradesModal && tradeTargetUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[780px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">[{tradeTargetUser.email}] 회원 실시간 거래 체결 내역</span>
                            <button onClick={() => setShowUserTradesModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
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
                                        {userTrades.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-6 text-slate-500">체결된 거래 내역이 존재하지 않습니다.</td>
                                            </tr>
                                        ) : (
                                            userTrades.map((t: any) => {
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
                            <button onClick={() => setShowUserTradesModal(false)} className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
