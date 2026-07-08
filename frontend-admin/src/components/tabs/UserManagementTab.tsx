import React, { useState } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { Users, Plus, Search } from 'lucide-react';
import { RegisterUserModal } from '../modals/RegisterUserModal';
import { EditUserModal } from '../modals/EditUserModal';
import { AdjustAssetModal } from '../modals/AdjustAssetModal';
import { UserTradesModal } from '../modals/UserTradesModal';
import type {User} from '../../types';

// 실시간 데이터 갱신으로 인한 불필요한 리렌더링 방지를 위해 memo로 감싸서 메모이제이션함.
export const UserManagementTab: React.FC = React.memo(() => {
    // 한 페이지당 출력할 회원 수 상수를 정의함.
    const USER_PAGE_SIZE = 10;
    // 개별 셀렉터를 사용하여 실시간 데이터 갱신으로 인한 불필요한 리렌더링 차단
    const users = useExchangeStore(state => state.users);
    const usersTotalElements = useExchangeStore(state => state.usersTotalElements || 0);
    const userTotalPages = useExchangeStore(state => state.usersTotalPages || 1);
    const updateUser = useExchangeStore(state => state.updateUser);
    const fetchUsers = useExchangeStore(state => state.fetchUsers);
    const searchUsersEs = useExchangeStore(state => state.searchUsersEs);
    const autocompleteEs = useExchangeStore(state => state.autocompleteEs);

    // Local filter/search states
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(0);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        fetchUsers(userPage, USER_PAGE_SIZE);
        // 페이지 번호가 변경될 때마다 해당 페이지의 회원 목록을 서버로부터 조회함.
    }, [userPage, fetchUsers]);

    // Debounce/ES Search Handler
    const searchTimeoutRef = React.useRef<any>(null);

    const handleSearchChange = (val: string) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(async () => {
            const trimmedVal = val.trim();
            try {
                if (trimmedVal === '') {
                    await fetchUsers(0, USER_PAGE_SIZE);
                    setSuggestions([]);
                } else {
                    searchUsersEs(trimmedVal);
                    const suggestList = await autocompleteEs(trimmedVal);
                    setSuggestions(suggestList || []);
                }
            } catch (error) {
                console.error("검색 중 오류 발생:", error);
                setSuggestions([]);
            }
        }, 300);
    };

    // Close suggestions dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Modal States
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [showAdjustAssetModal, setShowAdjustAssetModal] = useState(false);
    const [showUserTradesModal, setShowUserTradesModal] = useState(false);
    
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Helper functions
    const handleApproveUser = async (user: User) => {
        if (!window.confirm(`${user.email} 회원의 가입 신청을 승인하시겠습니까?`)) return;
        const ok = await updateUser(user.userId, user.email, user.grade, 'ACTIVE');
        if (ok) {
            alert('회원 가입 승인이 완료되었습니다.');
            fetchUsers(userPage, USER_PAGE_SIZE);
        } else {
            alert('가입 승인 처리에 실패했습니다.');
        }
    };
    
    const openModal = (modal: 'edit' | 'asset' | 'trades', user: User) => {
        setSelectedUser(user);
        if (modal === 'edit') setShowEditUserModal(true);
        else if (modal === 'asset') setShowAdjustAssetModal(true);
        else if (modal === 'trades') setShowUserTradesModal(true);
    };

    const closeModal = (modal: 'register' | 'edit' | 'asset' | 'trades') => {
        if (modal === 'register') setShowRegisterModal(false);
        else if (modal === 'edit') setShowEditUserModal(false);
        else if (modal === 'asset') setShowAdjustAssetModal(false);
        else if (modal === 'trades') setShowUserTradesModal(false);
        setSelectedUser(null);
    };

    const handleSuccess = (modal: 'register' | 'edit' | 'asset') => {
        closeModal(modal);
        fetchUsers(userPage, USER_PAGE_SIZE);
    };

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
                    <div ref={searchContainerRef} className="relative flex flex-col items-end">
                        <div className="relative flex items-center">
                            <Search size={14} className="absolute left-3 text-slate-500" />
                            <input
                                type="text"
                                placeholder="이메일 검색 (초성/부분)..."
                                value={userSearch}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setUserSearch(val);
                                    setUserPage(0);
                                    handleSearchChange(val);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                className="pl-9 pr-4 py-2 bg-slate-950/50 border border-white/10 rounded-xl text-xs font-medium text-white outline-none w-[250px] focus:border-[#00f2fe] focus:shadow-[0_0_10px_rgba(0,242,254,0.15)] transition-all"
                            />
                        </div>
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-10 right-0 w-[250px] bg-[#0d1426]/95 border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-50 max-h-[200px] overflow-y-auto divide-y divide-white/5 animate-fade-in backdrop-blur-md">
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setUserSearch(s);
                                            setUserPage(0);
                                            setShowSuggestions(false);
                                            searchUsersEs(s);
                                        }}
                                        className="px-4 py-2.5 hover:bg-[#8a2be2]/20 text-xs text-slate-200 hover:text-white cursor-pointer transition-colors font-semibold"
                                    >
                                        🔍 {s}
                                    </div>
                                ))}
                            </div>
                        )}
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
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-500">가입된 회원이 존재하지 않습니다.</td>
                                </tr>
                            ) : (
                                users.map(u => (
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
                                                    onClick={() => openModal('asset', u)}
                                                    className="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/12 transition-all"
                                                >
                                                    💸 자산 관리
                                                </button>
                                                <button
                                                    onClick={() => openModal('trades', u)}
                                                    className="px-3 py-1.5 rounded-lg border border-[#8a2be2]/25 bg-[#8a2be2]/5 text-[#c084fc] hover:bg-[#8a2be2]/12 transition-all"
                                                >
                                                    📈 거래 내역
                                                </button>
                                                <button
                                                    onClick={() => openModal('edit', u)}
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
                        Page <span className="text-white font-bold">{userPage + 1}</span> of <span className="text-white font-bold">{userTotalPages || 1}</span> (Total {usersTotalElements} users)
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

            <RegisterUserModal
                show={showRegisterModal}
                onClose={() => closeModal('register')}
                onSuccess={() => handleSuccess('register')}
            />

            <EditUserModal
                show={showEditUserModal}
                user={selectedUser}
                onClose={() => closeModal('edit')}
                onSuccess={() => handleSuccess('edit')}
            />

            <AdjustAssetModal
                show={showAdjustAssetModal}
                user={selectedUser}
                onClose={() => closeModal('asset')}
                onSuccess={() => handleSuccess('asset')}
            />

            <UserTradesModal
                show={showUserTradesModal}
                user={selectedUser}
                onClose={() => closeModal('trades')}
            />
        </div>
    );
});
UserManagementTab.displayName = 'UserManagementTab';
