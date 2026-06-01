import React, { useEffect, useState } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import { TradingViewChart } from './components/TradingViewChart';
import { TradingTerminal } from './components/TradingTerminal';
import { 
    LayoutDashboard, Users, ShieldAlert, MonitorPlay, ArrowDownRight, 
    ArrowUpRight, Activity, Plus, Search, Coins, X 
} from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
    const {
        activeSymbol,
        activeResolution,
        wsConnected,
        lastPrice,
        totalTradesCount,
        tradesLog,
        initStore,
        setActiveSymbol,
        setActiveResolution,
        apiBaseUrl,
        // 어드민 상태 및 메서드 가져오기
        users,
        wallets,
        walletsSummary,
        ledgerList,
        ledgerTotalCount,
        ledgerTotalPages,
        fetchUsers,
        registerUser,
        updateUser,
        fetchWallets,
        fetchWalletsSummary,
        adjustUserAsset,
        fetchLedgerList,
        fetchUserLedgers,
        fetchUserTrades
    } = useExchangeStore();

    // 탭 변수 확장 ('dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger')
    const [activeTab, setActiveTab] = useState<'dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger'>('market-watch');

    // 역할 뷰어 모드 스위처 ('admin' | 'user')
    const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');

    // 모달 제어 상태
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [showAdjustAssetModal, setShowAdjustAssetModal] = useState(false);
    const [showUserTradesModal, setShowUserTradesModal] = useState(false);

    // 신규 등록 폼 상태
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regGrade, setRegGrade] = useState('STANDARD');

    // 회원 정보 수정 상태
    const [editTargetUser, setEditTargetUser] = useState<any>(null);
    const [editGrade, setEditGrade] = useState('STANDARD');
    const [editStatus, setEditStatus] = useState('ACTIVE');

    // 자산 조정 폼 상태
    const [adjustTargetUser, setAdjustTargetUser] = useState<any>(null);
    const [adjustCurrency, setAdjustCurrency] = useState('KRW');
    const [adjustType, setAdjustType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [userLedgerHistory, setUserLedgerHistory] = useState<any[]>([]);

    // 개별 회원 체결 내역 상태
    const [tradeTargetUser, setTradeTargetUser] = useState<any>(null);
    const [userTrades, setUserTrades] = useState<any[]>([]);

    // 검색 및 페이징 상태
    const [userSearch, setUserSearch] = useState('');
    const [walletSearch, setWalletSearch] = useState('');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerPage, setLedgerPage] = useState(0);

    // 수동 입출금 즉시 인젝션 상태 (원장 탭)
    const [manualUserId, setManualUserId] = useState('');
    const [manualCurrency, setManualCurrency] = useState('KRW');
    const [manualType, setManualType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
    const [manualAmount, setManualAmount] = useState('');

    useEffect(() => {
        // 전역 스토어 초기화 및 웹소켓 연결
        initStore();
    }, [initStore]);

    // 1. 회원 통합 관리 탭 전용 데이터 로드 (탭 활성화 시 1회만 트리거)
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    // 2. 지갑 및 자산 관리 탭 전용 데이터 로드 (탭 활성화 시 1회만 트리거)
    useEffect(() => {
        if (activeTab === 'wallets') {
            fetchWallets();
            fetchWalletsSummary();
        }
    }, [activeTab]);

    // 3. 입출금 통합 관리 탭 전용 데이터 로드 (페이지 또는 검색어 변경 시에만 동적 트리거)
    useEffect(() => {
        if (activeTab === 'ledger') {
            fetchLedgerList(ledgerPage, 10, ledgerSearch);
        }
    }, [activeTab, ledgerPage, ledgerSearch]);

    // 4. 종합 대시보드 탭 전용 데이터 로드 (탭 활성화 시 1회만 트리거)
    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchUsers();
            fetchWalletsSummary();
        }
    }, [activeTab]);

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

    // 1. 신규 계정 개설 처리
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

    // 2. 회원 정보 변경 처리
    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTargetUser) return;
        const ok = await updateUser(editTargetUser.userId, editTargetUser.email, editGrade, editStatus);
        if (ok) {
            alert('회원 정보가 성공적으로 변경되었습니다.');
            setShowEditUserModal(false);
            fetchUsers();
        } else {
            alert('수정에 실패했습니다.');
        }
    };

    // 3. 개별 회원 자산 조정 인젝션
    const handleAdjustAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustTargetUser) return;
        const numAmount = parseFloat(adjustAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('올바른 금액 수치를 입력해 주세요.');
            return;
        }
        const finalAmount = adjustType === 'WITHDRAWAL' ? -numAmount : numAmount;
        const ok = await adjustUserAsset(adjustTargetUser.userId, adjustCurrency, finalAmount);
        if (ok) {
            alert('자산 변동 내역이 실시간 반영 완료되었습니다.');
            setShowAdjustAssetModal(false);
            setAdjustAmount('');
            if (activeTab === 'users') fetchUsers();
            if (activeTab === 'wallets') fetchWallets();
        } else {
            alert('자산 조작에 실패했습니다. 잔액이 모자란지 확인해주세요.');
        }
    };

    // 4. 수동 입출금 즉시 인젝션 (원장 탭)
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

    // 5. 회원 감사 이력 모달 호출
    const openAssetModal = async (u: any) => {
        setAdjustTargetUser(u);
        setAdjustAmount('');
        setShowAdjustAssetModal(true);
        const history = await fetchUserLedgers(u.userId);
        setUserLedgerHistory(history);
    };

    // 6. 회원 체결 이력 모달 호출
    const openTradesModal = async (u: any) => {
        setTradeTargetUser(u);
        setShowUserTradesModal(true);
        const trades = await fetchUserTrades(u.userId);
        setUserTrades(trades);
    };

    // 필터링 적용된 목록
    const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()));
    
    // 이메일 또는 통화로 지갑 검색 필터링
    const filteredWallets = wallets.filter(w => 
        w.email?.toLowerCase().includes(walletSearch.toLowerCase()) ||
        w.currency.toLowerCase().includes(walletSearch.toLowerCase()) ||
        w.userId.toString().includes(walletSearch)
    );

    // 전체 유통 자산 비례 게이지 계산
    const getMaxBalance = () => {
        if (!walletsSummary || walletsSummary.length === 0) return 1;
        return Math.max(...walletsSummary.map(s => s.totalBalance + s.totalLocked));
    };
    const maxBalance = getMaxBalance();

    return (
        <div className="app-container min-h-screen text-slate-100 flex flex-col font-sans bg-[#070b15]">
            {/* Top Glowing Header */}
            <header className="header-bar flex items-center justify-between px-8 py-4 sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#070b15]/95 shadow-2xl">
                <div className="logo-section flex items-center gap-3">
                    <div className="logo-glow w-4.5 h-4.5 rounded-full bg-gradient-to-r from-[#8a2be2] to-[#00f2fe] shadow-[0_0_15px_#8a2be2]" />
                    <span className="logo-title font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        JavaF <span className="text-xs logo-badge uppercase border border-[#00f2fe]/40 bg-[#00f2fe]/5 px-1.5 py-0.5 rounded text-[#00f2fe] font-bold tracking-wider ml-1">REACT ADVANCED</span>
                    </span>
                </div>

                <div className="header-controls flex items-center gap-4 text-xs font-semibold">
                    {/* 역할 뷰어 모드 스위처 */}
                    <div className="flex bg-white/5 border border-white/10 rounded-full p-0.5 font-bold mr-2">
                        <button
                            onClick={() => setViewMode('admin')}
                            className={`px-4 py-1.5 rounded-full transition-all text-[10px] uppercase tracking-wider font-extrabold ${viewMode === 'admin' ? 'bg-[#8a2be2] text-white shadow-[0_0_12px_rgba(138,43,226,0.4)]' : 'text-slate-400 hover:text-white'}`}
                        >
                            어드민 콘솔
                        </button>
                        <button
                            onClick={() => setViewMode('user')}
                            className={`px-4 py-1.5 rounded-full transition-all text-[10px] uppercase tracking-wider font-extrabold ${viewMode === 'user' ? 'bg-[#00f2fe] text-slate-950 shadow-[0_0_12px_rgba(0,242,254,0.4)]' : 'text-slate-400 hover:text-white'}`}
                        >
                            회원 거래소
                        </button>
                    </div>

                    <div className="host-config flex items-center bg-white/2 border border-white/5 px-4 py-1.5 rounded-full gap-2 text-slate-400">
                        <label className="uppercase tracking-wider font-bold text-[10px]">API Host</label>
                        <span className="text-[#00f2fe] font-mono">{apiBaseUrl.replace(/^https?:\/\//, '')}</span>
                    </div>

                    <div className={`status-badge flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-300 ${wsConnected ? 'bg-emerald-500/5 border-emerald-500/35 text-emerald-400' : 'bg-rose-500/5 border-rose-500/35 text-rose-400'}`}>
                        <span className={`status-dot w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`} />
                        <span>{wsConnected ? 'WS CONNECTED' : 'WS DISCONNECTED'}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
                {viewMode === 'user' ? (
                    <TradingTerminal />
                ) : (
                    <>
                        {/* Sidebar Navigation */}
                <aside className="w-[280px] bg-[#0a1020]/95 border-r border-white/5 flex flex-col p-6 gap-2 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <LayoutDashboard size={18} />
                        <span>통합 현황 분석</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('market-watch')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'market-watch' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <MonitorPlay size={18} />
                        <span>실시간 마켓 감시</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('users')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'users' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <Users size={18} />
                        <span>회원 통합 관리</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('wallets')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'wallets' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <Coins size={18} />
                        <span>지갑 및 자산 관리</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'ledger' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <ShieldAlert size={18} />
                        <span>입출금 통합 관리</span>
                    </button>
                </aside>

                {/* Main Workspace */}
                <main className="flex-1 p-8 overflow-y-auto max-w-[1600px] flex flex-col gap-6">
                    {/* TAB 1: DASHBOARD HOME (통합 현황 분석) */}
                    {activeTab === 'dashboard' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                                <LayoutDashboard size={20} className="text-[#8a2be2]" />
                                <span>종합 데이터 대시보드</span>
                            </div>
                            <div className="grid grid-cols-4 gap-6">
                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">전체 등록 회원</div>
                                    <div className="text-3xl font-black font-mono text-white mt-1">{users.length} 명</div>
                                    <div className="text-[10px] text-slate-400">실시간 등록 회원 원장 수</div>
                                </div>

                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">누적 체결 거래 수</div>
                                    <div className="text-3xl font-black font-mono text-[#00f2fe] mt-1">{totalTradesCount} 건</div>
                                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold mt-1">
                                        <Activity size={10} />
                                        <span>WebSocket 수신 실황</span>
                                    </div>
                                </div>

                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">감시 마켓 현재가</div>
                                    <div className="text-3xl font-black font-mono text-white mt-1">{lastPrice > 0 ? formatPrice(lastPrice) : '-'}</div>
                                    <div className="text-[10px] text-slate-400">{activeSymbol} 시황 데이터</div>
                                </div>

                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">24H 등락폭</div>
                                    <div className={`text-xl font-black font-mono mt-1.5 ${change24h.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {lastPrice > 0 ? change24h.text : '-'}
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
                    )}

                    {/* TAB 2: REAL-TIME MARKET WATCH (실시간 마켓 감시) */}
                    {activeTab === 'market-watch' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            {/* Section Header */}
                            <div className="flex items-center justify-between">
                                <div className="section-title text-xl font-black text-white flex items-center gap-2">
                                    <MonitorPlay size={20} className="text-[#8a2be2]" />
                                    <span>실시간 마켓 감시 모니터</span>
                                </div>

                                <div className="chart-controls flex gap-4 text-xs font-bold">
                                    {/* 심볼 스위처 */}
                                    <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setActiveSymbol('BTC-USD')}
                                            className={`px-4 py-1.5 rounded-md transition-all ${activeSymbol === 'BTC-USD' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            BTC-USD
                                        </button>
                                        <button
                                            onClick={() => setActiveSymbol('ADA-KRW')}
                                            className={`px-4 py-1.5 rounded-md transition-all ${activeSymbol === 'ADA-KRW' ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            ADA-KRW
                                        </button>
                                    </div>

                                    {/* 해상도 스위처 */}
                                    <div className="flex bg-white/2 border border-white/5 rounded-lg p-0.5">
                                        {(['1m', '5m', '15m', '1h'] as const).map((res) => (
                                            <button
                                                key={res}
                                                onClick={() => setActiveResolution(res)}
                                                className={`px-3 py-1.5 rounded-md uppercase transition-all ${activeResolution === res ? 'bg-[#8a2be2] text-white' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                {res}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Split Layout: Chart + Summary */}
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                {/* Chart Area */}
                                <div className="xl:col-span-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-sm font-bold text-white">{activeSymbol} 실시간 시세 차트</span>
                                        <span className="text-[10px] text-slate-400">MA7, MA25 및 볼륨 지표 오버레이</span>
                                    </div>
                                    <TradingViewChart />
                                </div>

                                {/* Core Summary Card */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-5 h-full">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">마켓 핵심 요약</div>
                                    
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">최종 체결 현재가</span>
                                        <span className="text-3xl font-black font-mono text-[#00f2fe] mt-1">
                                            {lastPrice > 0 ? formatPrice(lastPrice) : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col border-t border-white/5 pt-4">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">24H 전일 대비 등락폭</span>
                                        <span className={`text-sm font-black font-mono mt-1 flex items-center gap-1 ${change24h.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {change24h.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            {lastPrice > 0 ? change24h.text : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col border-t border-white/5 pt-4 gap-2">
                                        <div className="flex justify-between text-xs font-semibold text-slate-400">
                                            <span>시스템 총 체결량</span>
                                            <span className="text-white font-bold">{totalTradesCount} 건</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold text-slate-400">
                                            <span>오더북 감시 상태</span>
                                            <span className="text-emerald-400 font-bold">정상 (10단 전체)</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-semibold text-slate-400">
                                            <span>차트 안전 필터</span>
                                            <span className="text-[#8a2be2] font-bold">안심 가드 ON</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* WebSocket Log Monitor */}
                            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <span className="text-sm font-extrabold text-white">실시간 체결 로그 실황 (WebSocket Binary Stream)</span>
                                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <span>LIVE STREAMING</span>
                                    </span>
                                </div>

                                <div className="max-h-[220px] overflow-y-auto w-full bg-black/15 rounded-xl border border-white/5">
                                    <table className="w-full text-left text-xs font-medium">
                                        <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="px-5 py-3">체결 번호</th>
                                                <th className="px-5 py-3">종목코드</th>
                                                <th className="px-5 py-3">주문 방향</th>
                                                <th className="px-5 py-3 text-right">체결 가격</th>
                                                <th className="px-5 py-3 text-right">체결 수량</th>
                                                <th className="px-5 py-3 text-right">체결 시간</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {tradesLog.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-8 text-slate-500">
                                                        실시간 체결 대기 중... (바이너리 웹소켓 패킷 디코딩 대기)
                                                    </td>
                                                </tr>
                                            ) : (
                                                tradesLog.map((trade) => {
                                                    const isBuy = trade.side === 'BUY';
                                                    return (
                                                        <tr key={trade.tradeId} className="hover:bg-white/2 transition-colors">
                                                            <td className="px-5 py-3 font-mono text-slate-400">{trade.tradeId}</td>
                                                            <td className="px-5 py-3 font-bold text-white">{trade.symbol}</td>
                                                            <td className="px-5 py-3">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${isBuy ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                                    {isBuy ? 'BUY' : 'SELL'}
                                                                </span>
                                                            </td>
                                                            <td className={`px-5 py-3 text-right font-bold font-mono ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-5 py-3 text-right font-bold font-mono">{trade.qty.toLocaleString()}</td>
                                                            <td className="px-5 py-3 text-right text-slate-400">{new Date(trade.executedAt).toLocaleTimeString()}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: USER MANAGEMENT (회원 통합 관리) */}
                    {activeTab === 'users' && (
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
                                            onChange={(e) => setUserSearch(e.target.value)}
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
                                                filteredUsers.map(u => (
                                                    <tr key={u.userId} className="hover:bg-white/2 transition-colors">
                                                        <td className="px-5 py-4 font-mono font-bold text-[#00f2fe]">{u.userId}</td>
                                                        <td className="px-5 py-4 font-semibold text-white">{u.email}</td>
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${u.grade === 'VIP' ? 'bg-amber-500/10 border border-amber-500/35 text-amber-400' : 'bg-slate-500/10 border border-slate-500/35 text-slate-400'}`}>
                                                                {u.grade}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${u.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/35 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/35 text-rose-400'}`}>
                                                                {u.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-slate-400">{new Date(u.createdAt).toLocaleString()}</td>
                                                        <td className="px-5 py-4">
                                                            <div className="flex justify-end gap-2 text-[10px] font-bold">
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
                            </div>
                        </div>
                    )}

                    {/* TAB 4: WALLET MANAGEMENT (지갑 및 자산 관리) */}
                    {activeTab === 'wallets' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                                <Coins size={20} className="text-[#8a2be2]" />
                                <span>거래소 전체 지갑 원장 관리</span>
                            </div>

                            {/* 자산별 유통 요약 */}
                            <div className="grid grid-cols-4 gap-6">
                                {walletsSummary.map(s => {
                                    const total = s.totalBalance + s.totalLocked;

                                    return (
                                        <div key={s.currency} className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">거래소 내 총 보유 {s.currency}</div>
                                            <div className="text-3xl font-black font-mono text-white mt-1">
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
                                            onChange={(e) => setWalletSearch(e.target.value)}
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
                                                filteredWallets.map(w => {
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
                            </div>
                        </div>
                    )}

                    {/* TAB 5: DEPOSIT / WITHDRAWAL LEDGER (입출금 통합 관리) */}
                    {activeTab === 'ledger' && (
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
                                                    setLedgerPage(0);
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
                                                    ledgerList.map(l => (
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
                                                onClick={() => setLedgerPage(prev => Math.max(prev - 1, 0))}
                                                className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                                            >
                                                ◀ 이전
                                            </button>
                                            <button 
                                                disabled={ledgerPage + 1 >= ledgerTotalPages}
                                                onClick={() => setLedgerPage(prev => Math.min(prev + 1, ledgerTotalPages - 1))}
                                                className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/2 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white font-bold transition-all"
                                            >
                                                다음 ▶
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
                    </>
                )}
            </div>

            {/* ======================================================= */}
            {/* MODALS WINDOWS (팝업 모달 시스템) */}
            {/* ======================================================= */}

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
                                        onChange={(e) => setRegGrade(e.target.value)}
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
                                        onChange={(e) => setEditStatus(e.target.value)}
                                        className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg text-white outline-none"
                                    >
                                        <option value="ACTIVE">ACTIVE (거래 가능)</option>
                                        <option value="SUSPENDED">SUSPENDED (거래정지)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">보안 등급</label>
                                    <select 
                                        value={editGrade}
                                        onChange={(e) => setEditGrade(e.target.value)}
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

            {/* Modal 3: Adjust User Assets (자산 조정 및 입출금 인젝션) */}
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
                                                    userLedgerHistory.map((l, idx) => (
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

            {/* Modal 4: User Trade History (회원 거래 내역 조회) */}
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
                                            userTrades.map(t => {
                                                const isBuy = t.side === 'BUY';
                                                const displayPrice = t.symbol.includes("BTC") ? (t.price / 100.0) : t.price;
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
