import React, { useEffect, useState } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import { TradingViewChart } from './components/TradingViewChart';
import { 
    LayoutDashboard, Users, ShieldAlert, MonitorPlay, ArrowDownRight, 
    ArrowUpRight, Activity, Plus, Search, Coins, X, Settings
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
        fetchUserTrades,
        fetchSummaryStats,
        isAuthenticated,
        login,
        logout,
        authEmail,
        duplicateLoginBlockEnabled,
        fetchSettings,
        toggleDuplicateLoginBlock,
        sendWsMessage,
        // custody 관련 추가
        btcConfirmations,
        ethConfirmations,
        adaConfirmations,
        cryptoWithdrawals,
        hotWallets,
        userCryptoAddresses,
        pendingDeposits,
        blockHeight,
        updateConfirmationsSettings,
        fetchCryptoWithdrawals,
        fetchHotWallets,
        fetchUserCryptoAddresses,
        fetchPendingDeposits,
        fetchBlockHeight,
        approveWithdrawal,
        rejectWithdrawal,
        rebalanceHotWallet,
        requestCryptoWithdrawal
    } = useExchangeStore();

    // 탭 변수 확장 ('dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger' | 'settings' | 'custody')
    const [activeTab, setActiveTab] = useState<'dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger' | 'settings' | 'custody'>('market-watch');


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
    const [userPage, setUserPage] = useState(0);
    const [walletSearch, setWalletSearch] = useState('');
    const [walletPage, setWalletPage] = useState(0);
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerPage, setLedgerPage] = useState(0);

    // 수동 입출금 즉시 인젝션 상태 (원장 탭)
    const [manualUserId, setManualUserId] = useState('');
    const [manualCurrency, setManualCurrency] = useState('KRW');
    const [manualType, setManualType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
    const [manualAmount, setManualAmount] = useState('');

    // 실시간 스트리밍 모니터 일시 정지(Pause) 제어 상태
    const [isStreamingPaused, setIsStreamingPaused] = useState(true);
    const [frozenTradesLog, setFrozenTradesLog] = useState<any[]>([]);

    // 블록 컨펌 수 임시 입력 상태
    const [btcInput, setBtcInput] = useState<number>(3);
    const [ethInput, setEthInput] = useState<number>(6);
    const [adaInput, setAdaInput] = useState<number>(10);

    // 스토어에서 컨펌 수 설정값을 받아오면 로컬 state에 동기화
    useEffect(() => {
        setBtcInput(btcConfirmations);
        setEthInput(ethConfirmations);
        setAdaInput(adaConfirmations);
    }, [btcConfirmations, ethConfirmations, adaConfirmations]);

    // 온체인 수동 출금 테스트 상태
    const [custodyWithdrawUserId, setCustodyWithdrawUserId] = useState('');
    const [custodyWithdrawCurrency, setCustodyWithdrawCurrency] = useState('BTC');
    const [custodyWithdrawAmount, setCustodyWithdrawAmount] = useState('');
    const [custodyWithdrawAddress, setCustodyWithdrawAddress] = useState('');

    // 환경 설정 모의 스위치 로컬 상태
    const [mockPlaySound, setMockPlaySound] = useState(true);
    const [mockEmailAlert, setMockEmailAlert] = useState(false);
    const [mockMatchingEngineMode, setMockMatchingEngineMode] = useState<'FIFO' | 'LIFO'>('FIFO');
    const [mockMaintenanceMode, setMockMaintenanceMode] = useState(false);

    // 웹 기반 실시간 주문 생성 시뮬레이터 (Web Order Generator) 상태
    const [webGenActive, setWebGenActive] = useState(false);
    const [webGenSymbol, setWebGenSymbol] = useState<'BTC-USD' | 'ADA-KRW'>('BTC-USD');
    const [webGenSide, setWebGenSide] = useState<'BUY' | 'SELL' | 'RANDOM'>('RANDOM');
    const [webGenInterval, setWebGenInterval] = useState<number>(300); // 300ms 기본값
    const [webGenMinPrice, setWebGenMinPrice] = useState<string>('64000');
    const [webGenMaxPrice, setWebGenMaxPrice] = useState<string>('65000');
    const [webGenMinQty, setWebGenMinQty] = useState<string>('1');
    const [webGenMaxQty, setWebGenMaxQty] = useState<string>('10');
    const [webGenMinUserId, setWebGenMinUserId] = useState<string>('1');
    const [webGenMaxUserId, setWebGenMaxUserId] = useState<string>('1000');
    const [webGenLogs, setWebGenLogs] = useState<string[]>([]);

    // Web Order Generator Loop
    useEffect(() => {
        if (!webGenActive) return;

        let timerId: any = null;

        const generateOrder = () => {
            const minP = parseFloat(webGenMinPrice) || 10;
            const maxP = parseFloat(webGenMaxPrice) || 100;
            const minQ = parseFloat(webGenMinQty) || 1;
            const maxQ = parseFloat(webGenMaxQty) || 10;
            const minU = parseInt(webGenMinUserId) || 1;
            const maxU = parseInt(webGenMaxUserId) || 1000;

            const side = webGenSide === 'RANDOM' 
                ? (Math.random() < 0.5 ? 'BUY' : 'SELL')
                : webGenSide;

            // Generate price within range
            const price = minP + Math.random() * (maxP - minP);
            // Generate quantity within range
            const qty = minQ + Math.random() * (maxQ - minQ);
            // Generate userId within range
            const userId = minU + Math.floor(Math.random() * (maxU - minU + 1));

            const scaledPrice = Math.round(price * 100);
            const scaledQty = Math.round(qty);

            const payload = {
                action: 'NEW',
                symbol: webGenSymbol,
                side: side,
                price: scaledPrice,
                qty: scaledQty,
                userId: userId
            };

            const success = sendWsMessage(payload);
            const timeStr = new Date().toLocaleTimeString().split(' ')[0];

            if (success) {
                const logMsg = `[${timeStr}] ${webGenSymbol} ${side} 주문 전송: 가격 ${price.toLocaleString(undefined, {minimumFractionDigits: 2})} / 수량 ${scaledQty} (User: ${userId})`;
                setWebGenLogs(prev => [logMsg, ...prev].slice(0, 30));
            } else {
                const logMsg = `[${timeStr}] 주문 전송 실패 (웹소켓 연결 확인 필요)`;
                setWebGenLogs(prev => [logMsg, ...prev].slice(0, 30));
            }

            // Schedule next order
            timerId = setTimeout(generateOrder, webGenInterval);
        };

        timerId = setTimeout(generateOrder, webGenInterval);

        return () => {
            if (timerId) clearTimeout(timerId);
        };
    }, [
        webGenActive,
        webGenSymbol,
        webGenSide,
        webGenInterval,
        webGenMinPrice,
        webGenMaxPrice,
        webGenMinQty,
        webGenMaxQty,
        webGenMinUserId,
        webGenMaxUserId,
        sendWsMessage
    ]);

    // 대상 심볼 선택에 따라 시뮬레이터 가격/수량 조건 기본값 자동 갱신
    useEffect(() => {
        if (webGenSymbol === 'BTC-USD') {
            setWebGenMinPrice('64000');
            setWebGenMaxPrice('65000');
            setWebGenMinQty('1');
            setWebGenMaxQty('10');
        } else {
            setWebGenMinPrice('450');
            setWebGenMaxPrice('550');
            setWebGenMinQty('100');
            setWebGenMaxQty('1000');
        }
    }, [webGenSymbol]);

    // 로그인 폼 입력 상태
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) {
            alert('이메일과 비밀번호를 입력해 주세요.');
            return;
        }
        const res = await login(loginEmail, loginPassword);
        if (res.success) {
            if (res.priorLoginExisted) {
                alert('⚠️ 다른 기기나 브라우저에서 먼저 로그인했던 관리자 세션이 감지되었습니다. 이전 세션은 즉시 안전하게 로그아웃(세션 파기) 처리됩니다.');
            } else {
                alert('로그인 성공');
            }
        } else {
            alert('로그인 정보가 올바르지 않습니다.');
        }
    };

    useEffect(() => {
        // 전역 스토어 초기화 및 웹소켓 연결
        initStore();
        if (isAuthenticated) {
            fetchSummaryStats();
        }
        // 5초 주기로 누적 거래 수 등 DB 스냅샷 정보를 주기적 갱신 및 동기화한다.
        const timer = setInterval(() => {
            if (isAuthenticated) {
                fetchSummaryStats();
            }
        }, 5000);
        return () => clearInterval(timer);
    }, [initStore, fetchSummaryStats, isAuthenticated]);

    useEffect(() => {
        if (!isStreamingPaused) {
            setFrozenTradesLog(tradesLog);
        }
    }, [tradesLog, isStreamingPaused]);

    // 0. 대시보드, 설정 또는 Custody 탭 활성화 또는 로그인 성공 시 환경 설정 동기화
    useEffect(() => {
        if (isAuthenticated && (activeTab === 'dashboard' || activeTab === 'settings' || activeTab === 'custody')) {
            fetchSettings();
        }
    }, [isAuthenticated, activeTab, fetchSettings]);

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
            fetchSummaryStats();
        }
    }, [activeTab, fetchSummaryStats]);

    // 5. 온체인 입출금 관리(Custody) 탭 전용 데이터 로드 및 3초 주기 폴링
    useEffect(() => {
        if (activeTab === 'custody') {
            const loadData = () => {
                fetchHotWallets();
                fetchCryptoWithdrawals();
                fetchUserCryptoAddresses();
                fetchPendingDeposits();
                fetchBlockHeight();
            };
            loadData();
            const interval = setInterval(loadData, 3000);
            return () => clearInterval(interval);
        }
    }, [activeTab, fetchHotWallets, fetchCryptoWithdrawals, fetchUserCryptoAddresses, fetchPendingDeposits, fetchBlockHeight]);

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
    const USER_PAGE_SIZE = 20;
    const userTotalPages = Math.ceil(filteredUsers.length / USER_PAGE_SIZE);
    const paginatedUsers = filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE);
    
    // 이메일 또는 통화로 지갑 검색 필터링
    const filteredWallets = wallets.filter(w => 
        w.email?.toLowerCase().includes(walletSearch.toLowerCase()) ||
        w.currency.toLowerCase().includes(walletSearch.toLowerCase()) ||
        w.userId.toString().includes(walletSearch)
    );
    const WALLET_PAGE_SIZE = 20;
    const walletTotalPages = Math.ceil(filteredWallets.length / WALLET_PAGE_SIZE);
    const paginatedWallets = filteredWallets.slice(walletPage * WALLET_PAGE_SIZE, (walletPage + 1) * WALLET_PAGE_SIZE);

    // 전체 유통 자산 비례 게이지 계산
    const getMaxBalance = () => {
        if (!walletsSummary || walletsSummary.length === 0) return 1;
        return Math.max(...walletsSummary.map(s => s.totalBalance + s.totalLocked));
    };
    const maxBalance = getMaxBalance();

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen text-slate-100 flex items-center justify-center font-sans bg-[#070b15] relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#8a2be2]/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#00f2fe]/10 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="relative z-10 w-[420px] bg-slate-900/60 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-3">
                        <div className="logo-glow w-6 h-6 rounded-full bg-gradient-to-r from-[#8a2be2] to-[#00f2fe] shadow-[0_0_20px_#8a2be2] animate-pulse" />
                        <h1 className="text-2xl font-black tracking-tight text-white mt-2">JavaF 어드민 콘솔</h1>
                        <p className="text-xs text-slate-400 text-center">보안 구역 로그인이 필요함</p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 text-xs font-semibold">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">이메일 계정</label>
                            <input 
                                type="email" 
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="admin@example.com"
                                required
                                className="w-full p-3.5 bg-slate-950/80 border border-white/10 rounded-xl text-white outline-none focus:border-[#8a2be2] focus:shadow-[0_0_12px_rgba(138,43,226,0.15)] transition-all font-medium"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-slate-400 uppercase text-[10px]">비밀번호</label>
                            <input 
                                type="password" 
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full p-3.5 bg-slate-950/80 border border-white/10 rounded-xl text-white outline-none focus:border-[#8a2be2] focus:shadow-[0_0_12px_rgba(138,43,226,0.15)] transition-all font-medium"
                            />
                        </div>

                        {/* 시드 자격증명 원클릭 자동완성 버튼 배지 추가 */}
                        <div className="flex flex-col gap-1.5 mt-1">
                            <label className="text-slate-500 uppercase text-[9px] tracking-wider font-bold">빠른 자격 증명 선택</label>
                            <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setLoginEmail('admin@javaf.net');
                                        setLoginPassword('admin123');
                                    }}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:bg-[#8a2be2]/20 hover:border-[#8a2be2]/40 hover:text-white transition-all font-bold"
                                >
                                    🔑 기본 관리자 (admin@javaf.net / admin123)
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="w-full py-4.5 bg-gradient-to-r from-[#8a2be2] to-[#4b0082] rounded-xl text-white font-extrabold text-xs tracking-wider uppercase shadow-xl hover:brightness-110 active:scale-[0.98] transition-all mt-2"
                        >
                            콘솔 로그인 인증
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container min-h-screen text-slate-100 flex flex-col font-sans bg-[#070b15]">
            {/* Top Glowing Header */}
            <header className="header-bar flex items-center justify-between px-8 py-4 sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#070b15]/95 shadow-2xl">
                <div className="logo-section flex items-center gap-3">
                    <div className="logo-glow w-4.5 h-4.5 rounded-full bg-gradient-to-r from-[#8a2be2] to-[#00f2fe] shadow-[0_0_15px_#8a2be2]" />
                    <span className="logo-title font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        JavaF <span className="text-xs logo-badge uppercase border border-[#00f2fe]/40 bg-[#00f2fe]/5 px-1.5 py-0.5 rounded text-[#00f2fe] font-bold tracking-wider ml-1">EXCHANGE ADMIN</span>
                    </span>
                </div>

                <div className="header-controls flex items-center gap-4 text-xs font-semibold">
                    <div className="host-config flex items-center bg-white/2 border border-white/5 px-4 py-1.5 rounded-full gap-2 text-slate-400">
                        <label className="uppercase tracking-wider font-bold text-[10px]">API Host</label>
                        <span className="text-[#00f2fe] font-mono">{apiBaseUrl.replace(/^https?:\/\//, '')}</span>
                    </div>

                    <div className={`status-badge flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-300 ${wsConnected ? 'bg-emerald-500/5 border-emerald-500/35 text-emerald-400' : 'bg-rose-500/5 border-rose-500/35 text-rose-400'}`}>
                        <span className={`status-dot w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`} />
                        <span>{wsConnected ? 'WS CONNECTED' : 'WS DISCONNECTED'}</span>
                    </div>

                    {/* 로그인 인증 계정 정보 및 로그아웃 버튼 추가 */}
                    <div className="auth-user-badge flex items-center bg-white/5 border border-white/10 px-4.5 py-1.5 rounded-full gap-3 text-slate-300 font-bold">
                        <span className="text-white text-[11px] font-mono">{authEmail}</span>
                        <button 
                            onClick={logout}
                            className="text-[#ff4757] hover:text-[#ff6b81] transition-colors border-l border-white/10 pl-3 uppercase tracking-wider text-[9px] font-black"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
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

                    <button
                        onClick={() => setActiveTab('custody')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'custody' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <Coins size={18} className="text-[#8a2be2]" />
                        <span>온체인 입출금 관리 (Custody)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'settings' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <Settings size={18} />
                        <span>시스템 환경 설정</span>
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
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setIsStreamingPaused(prev => !prev)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border transition-all ${isStreamingPaused ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-white/2 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                        >
                                            {isStreamingPaused ? '▶ 실시간 감시 재개' : '⏸ 실시간 감시 일시정지 (성능 절약)'}
                                        </button>
                                        <span className={`text-[10px] flex items-center gap-1 font-semibold ${isStreamingPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isStreamingPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                            <span>{isStreamingPaused ? 'PAUSED' : 'LIVE STREAMING'}</span>
                                        </span>
                                    </div>
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
                                            {frozenTradesLog.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-8 text-slate-500">
                                                        실시간 체결 대기 중... (바이너리 웹소켓 패킷 디코딩 대기)
                                                    </td>
                                                </tr>
                                            ) : (
                                                frozenTradesLog.map((trade) => {
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

                    {/* TAB 6: SYSTEM SETTINGS (시스템 환경 설정) */}
                    {activeTab === 'settings' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                                <Settings size={20} className="text-[#8a2be2]" />
                                <span>시스템 환경 설정</span>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* 1. 어드민 보안 설정 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <ShieldAlert size={16} className="text-[#8a2be2]" />
                                        <span>어드민 보안 설정</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-xl hover:border-[#8a2be2]/30 transition-all duration-300">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                중복 로그인 차단 활성화 (Enforce Single Session)
                                                {duplicateLoginBlockEnabled ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#8a2be2]/20 border border-[#8a2be2]/45 text-[#c084fc] animate-pulse">ACTIVE</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-slate-500/10 border border-slate-500/35 text-slate-400">DISABLED</span>
                                                )}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                활성화 시 다른 기기나 브라우저에서 중복 로그인할 경우 이전 세션이 즉시 만료 및 로그아웃 처리됩니다.
                                            </span>
                                        </div>
                                        <div className="flex items-center">
                                            <button 
                                                onClick={() => toggleDuplicateLoginBlock(!duplicateLoginBlockEnabled)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${duplicateLoginBlockEnabled ? 'bg-[#8a2be2]' : 'bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${duplicateLoginBlockEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. 모니터링 및 알림 설정 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <Activity size={16} className="text-[#00f2fe]" />
                                        <span>모니터링 및 알림 설정 (시뮬레이션)</span>
                                    </div>
                                    
                                    {/* 소리 알림 */}
                                    <div className="flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-xl hover:border-[#00f2fe]/30 transition-all duration-300">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-white">실시간 체결 알림 효과음 재생</span>
                                            <span className="text-[10px] text-slate-400">신규 거래 체결 시 브라우저 오디오 효과음 알림을 재생합니다.</span>
                                        </div>
                                        <div className="flex items-center">
                                            <button 
                                                onClick={() => setMockPlaySound(!mockPlaySound)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${mockPlaySound ? 'bg-[#00f2fe]' : 'bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${mockPlaySound ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 이메일 알림 */}
                                    <div className="flex items-center justify-between p-4 bg-slate-900/40 border border-white/5 rounded-xl hover:border-[#00f2fe]/30 transition-all duration-300">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-white">시스템 오류 및 이상 징후 이메일 긴급 전송</span>
                                            <span className="text-[10px] text-slate-400">시스템 예외 발생 시 관리자 이메일 계정({authEmail})으로 오류 보고서를 발송합니다.</span>
                                        </div>
                                        <div className="flex items-center">
                                            <button 
                                                onClick={() => setMockEmailAlert(!mockEmailAlert)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${mockEmailAlert ? 'bg-[#00f2fe]' : 'bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${mockEmailAlert ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. 블록 컨펌 수 설정 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <Coins size={16} className="text-[#8a2be2]" />
                                        <span>온체인 블록 컨펌 수 설정</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-white/5 rounded-xl">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-bold text-white">BTC 입금 컨펌 수</span>
                                                <span className="text-[10px] text-slate-400">비트코인 입금 반영을 위한 블록 확인 횟수</span>
                                            </div>
                                            <input 
                                                type="number"
                                                value={btcInput}
                                                onChange={(e) => setBtcInput(Number(e.target.value))}
                                                className="w-20 p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-bold text-center outline-none focus:border-[#8a2be2]"
                                                min={1}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-white/5 rounded-xl">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-bold text-white">ETH 입금 컨펌 수</span>
                                                <span className="text-[10px] text-slate-400">이더리움 입금 반영을 위한 블록 확인 횟수</span>
                                            </div>
                                            <input 
                                                type="number"
                                                value={ethInput}
                                                onChange={(e) => setEthInput(Number(e.target.value))}
                                                className="w-20 p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-bold text-center outline-none focus:border-[#8a2be2]"
                                                min={1}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-white/5 rounded-xl">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-bold text-white">ADA 입금 컨펌 수</span>
                                                <span className="text-[10px] text-slate-400">에이다 입금 반영을 위한 블록 확인 횟수</span>
                                            </div>
                                            <input 
                                                type="number"
                                                value={adaInput}
                                                onChange={(e) => setAdaInput(Number(e.target.value))}
                                                className="w-20 p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-bold text-center outline-none focus:border-[#8a2be2]"
                                                min={1}
                                            />
                                        </div>
                                        <button
                                            onClick={async () => {
                                                await updateConfirmationsSettings(btcInput, ethInput, adaInput);
                                                alert("블록 컨펌 수 설정이 저장되었습니다.");
                                            }}
                                            className="w-full py-2.5 bg-gradient-to-r from-[#8a2be2] to-[#00f2fe] hover:scale-[1.01] transition-transform text-white text-xs font-bold rounded-lg mt-1"
                                        >
                                            컨펌 수 설정 저장
                                        </button>
                                    </div>
                                </div>

                                {/* 4. 거래소 운영 모드 설정 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4 xl:col-span-2">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <Coins size={16} className="text-amber-500" />
                                        <span>거래소 운영 정책 구성 (시뮬레이션)</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 매칭 규칙 선택 */}
                                        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-white">매칭 엔진 오더북 체결 규칙</span>
                                                <span className="text-[10px] text-slate-400">거래 엔진의 매칭 우선순위 알고리즘을 선택합니다.</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {(['FIFO', 'LIFO'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        onClick={() => setMockMatchingEngineMode(mode)}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${mockMatchingEngineMode === mode ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-transparent border-white/10 text-slate-400 hover:text-white'}`}
                                                    >
                                                        {mode} (선입선출 우선)
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 유지보수 모드 */}
                                        <div className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-white">거래소 점검 모드 활성화</span>
                                                <span className="text-[10px] text-slate-400">활성화 시 일반 사용자 거래 터미널 접속 및 주문 요청이 차단됩니다.</span>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => setMockMaintenanceMode(!mockMaintenanceMode)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${mockMaintenanceMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${mockMaintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. 실시간 웹 모의 주문 생성기 (Web Order Generator) */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4 xl:col-span-2">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-[#00f2fe]" />
                                            <span>실시간 웹 모의 주문 생성기 (Web Order Generator)</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-bold">
                                            <span className={`w-2 h-2 rounded-full ${webGenActive ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                                            <span className={webGenActive ? 'text-emerald-400' : 'text-rose-400'}>
                                                {webGenActive ? '동작 중 (RUNNING)' : '정지됨 (STOPPED)'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* 설정 필드 영역 (좌측 2개 열) */}
                                        <div className="lg:col-span-2 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-300">
                                            {/* 대상 마켓 선택 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">대상 마켓 심볼</label>
                                                <select 
                                                    value={webGenSymbol}
                                                    onChange={(e) => setWebGenSymbol(e.target.value as any)}
                                                    className="p-2.5 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                                >
                                                    <option value="BTC-USD">BTC-USD (비트코인)</option>
                                                    <option value="ADA-KRW">ADA-KRW (에이다)</option>
                                                </select>
                                            </div>

                                            {/* 매칭 측면 선택 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">주문 방향 (Side)</label>
                                                <select 
                                                    value={webGenSide}
                                                    onChange={(e) => setWebGenSide(e.target.value as any)}
                                                    className="p-2.5 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                                >
                                                    <option value="RANDOM">RANDOM (매수/매도 반반)</option>
                                                    <option value="BUY">BUY (매수 전용)</option>
                                                    <option value="SELL">SELL (매도 전용)</option>
                                                </select>
                                            </div>

                                            {/* 생성 주기 선택 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">주문 생성 주기 (속도)</label>
                                                <select 
                                                    value={webGenInterval}
                                                    onChange={(e) => setWebGenInterval(Number(e.target.value))}
                                                    className="p-2.5 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                                >
                                                    <option value={50}>50ms (초당 20건 - 고부하)</option>
                                                    <option value={100}>100ms (초당 10건 - 고부하)</option>
                                                    <option value={300}>300ms (초당 3.3건 - 표준)</option>
                                                    <option value={500}>500ms (초당 2건 - 표준)</option>
                                                    <option value={1000}>1000ms (초당 1건 - 저부하)</option>
                                                    <option value={2000}>2000ms (2초당 1건 - 저부하)</option>
                                                </select>
                                            </div>

                                            {/* 사용자 UID 범위 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">유저 UID 범위</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={webGenMinUserId} 
                                                        onChange={(e) => setWebGenMinUserId(e.target.value)}
                                                        placeholder="최소" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                    <span className="text-slate-500">~</span>
                                                    <input 
                                                        type="number" 
                                                        value={webGenMaxUserId} 
                                                        onChange={(e) => setWebGenMaxUserId(e.target.value)}
                                                        placeholder="최대" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                </div>
                                            </div>

                                            {/* 가격 범위 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">주문 생성 가격 범위 (Min ~ Max)</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={webGenMinPrice} 
                                                        onChange={(e) => setWebGenMinPrice(e.target.value)}
                                                        placeholder="최소 가격" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                    <span className="text-slate-500">~</span>
                                                    <input 
                                                        type="number" 
                                                        value={webGenMaxPrice} 
                                                        onChange={(e) => setWebGenMaxPrice(e.target.value)}
                                                        placeholder="최대 가격" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                </div>
                                            </div>

                                            {/* 수량 범위 */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-slate-400 uppercase text-[10px]">주문 수량 범위 (Min ~ Max)</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={webGenMinQty} 
                                                        onChange={(e) => setWebGenMinQty(e.target.value)}
                                                        placeholder="최소" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                    <span className="text-slate-500">~</span>
                                                    <input 
                                                        type="number" 
                                                        value={webGenMaxQty} 
                                                        onChange={(e) => setWebGenMaxQty(e.target.value)}
                                                        placeholder="최대" 
                                                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 실시간 웹로그 출력 영역 (우측 1개 열) */}
                                        <div className="flex flex-col gap-1.5 h-full">
                                            <label className="text-slate-400 uppercase text-[10px] font-bold">생성 로그 콘솔</label>
                                            <div className="flex-1 min-h-[150px] bg-black/40 border border-white/5 rounded-xl p-3 font-mono text-[9px] text-slate-300 overflow-y-auto flex flex-col gap-1 max-h-[220px]">
                                                {webGenLogs.length === 0 ? (
                                                    <span className="text-slate-500">생성기가 대기 중입니다. 시작 버튼을 클릭해 주세요.</span>
                                                ) : (
                                                    webGenLogs.map((log, idx) => (
                                                        <div key={idx} className="whitespace-nowrap overflow-hidden text-ellipsis text-left">
                                                            {log}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 시작 / 종료 토글 제어 버튼 */}
                                    <div className="flex justify-end gap-3 mt-2 border-t border-white/5 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setWebGenLogs([])}
                                            className="px-4 py-2 border border-white/10 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-all"
                                        >
                                            로그 지우기
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWebGenActive(!webGenActive)}
                                            className={`px-6 py-2 rounded-xl font-extrabold text-xs text-white shadow-lg transition-all hover:scale-[1.01] ${webGenActive ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-[#8a2be2] to-[#00f2fe]'}`}
                                        >
                                            {webGenActive ? '시뮬레이터 정지' : '웹 시뮬레이터 시작'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 7: CUSTODY MANAGEMENT (온체인 입출금 관리) */}
                    {activeTab === 'custody' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            <div className="section-title text-xl font-black text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Coins size={20} className="text-[#8a2be2]" />
                                    <span>온체인 커스터디(Custody) 자산 및 입출금 관리</span>
                                </div>
                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs text-slate-300 font-bold">
                                    <Coins size={14} className="text-[#8a2be2] animate-pulse" />
                                    <span>시뮬레이션 블록 높이: <span className="text-white font-mono">{blockHeight}</span></span>
                                </div>
                            </div>

                            {/* 1. 핫 월렛 보유 현황 & 출금 테스트 */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                {/* 핫 월렛 카드 (2열 차지) */}
                                <div className="xl:col-span-2 bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <Coins size={16} className="text-[#8a2be2]" />
                                        <span>시스템 핫 월렛(System Hot Wallet) 잔고</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {hotWallets.map((hw: any) => (
                                            <div key={hw.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-xl flex flex-col gap-3 justify-between hover:border-[#00f2fe]/30 transition-all duration-300">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-white">{hw.currency} 핫월렛</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe]">CUSTODY</span>
                                                    </div>
                                                    <span className="text-lg font-black text-white font-mono tracking-wider mt-1">{hw.balance.toLocaleString(undefined, { maximumFractionDigits: hw.currency === 'ADA' ? 2 : 6 })} <span className="text-[10px] text-slate-400 font-bold">{hw.currency}</span></span>
                                                    <span className="text-[9px] text-slate-500 font-mono break-all mt-1">{hw.address}</span>
                                                </div>
                                                <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
                                                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                                                        <span>안전 임계값:</span>
                                                        <span className="text-amber-400">{hw.thresholdAmount} {hw.currency}</span>
                                                    </div>
                                                    {hw.balance < hw.thresholdAmount && (
                                                        <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-center">잔고 부족 경고 - 보충 필요</span>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            const amtStr = prompt(`${hw.currency} 핫월렛에 공급할 수량을 입력하세요:`, (hw.thresholdAmount * 2).toString());
                                                            if (amtStr && !isNaN(Number(amtStr))) {
                                                                const success = await rebalanceHotWallet(hw.id, Number(amtStr));
                                                                if (success) alert(`${hw.currency} 핫월렛에 ${amtStr} 자산이 정상 공급되었습니다.`);
                                                            }
                                                        }}
                                                        className="w-full py-1 bg-white/5 hover:bg-[#00f2fe]/10 hover:text-white transition-all text-slate-400 text-[10px] font-bold rounded-lg mt-1 border border-white/5 hover:border-[#00f2fe]/30"
                                                    >
                                                        핫 월렛 자산 공급
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 출금 테스트 폼 (1열 차지) */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                        <ArrowUpRight size={16} className="text-rose-400" />
                                        <span>온체인 출금 모의 요청</span>
                                    </div>
                                    <div className="flex flex-col gap-3 text-xs font-semibold">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-slate-400">사용자 UID</label>
                                            <input 
                                                type="number"
                                                value={custodyWithdrawUserId}
                                                onChange={(e) => setCustodyWithdrawUserId(e.target.value)}
                                                placeholder="예: 1"
                                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-slate-400">출금 자산</label>
                                            <select
                                                value={custodyWithdrawCurrency}
                                                onChange={(e) => setCustodyWithdrawCurrency(e.target.value)}
                                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                            >
                                                <option value="BTC">BTC</option>
                                                <option value="ETH">ETH</option>
                                                <option value="ADA">ADA</option>
                                                <option value="JAF">JAF</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-slate-400">출금 수량</label>
                                            <input 
                                                type="number"
                                                value={custodyWithdrawAmount}
                                                onChange={(e) => setCustodyWithdrawAmount(e.target.value)}
                                                placeholder="0.0"
                                                step="0.0001"
                                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] text-slate-400">수신 온체인 주소</label>
                                            <input 
                                                type="text"
                                                value={custodyWithdrawAddress}
                                                onChange={(e) => setCustodyWithdrawAddress(e.target.value)}
                                                placeholder="0x... 또는 btc1..."
                                                className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono outline-none focus:border-[#8a2be2]"
                                            />
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!custodyWithdrawUserId || !custodyWithdrawAmount || !custodyWithdrawAddress) {
                                                    alert("모든 필드를 채워주세요.");
                                                    return;
                                                }
                                                const success = await requestCryptoWithdrawal(
                                                    Number(custodyWithdrawUserId),
                                                    custodyWithdrawCurrency,
                                                    Number(custodyWithdrawAmount),
                                                    custodyWithdrawAddress
                                                );
                                                if (success) {
                                                    alert("온체인 출금 요청이 정상 등록되어 승인 대기열에 추가되었습니다.");
                                                    setCustodyWithdrawUserId('');
                                                    setCustodyWithdrawAmount('');
                                                    setCustodyWithdrawAddress('');
                                                }
                                            }}
                                            className="w-full py-2 bg-gradient-to-r from-rose-600 to-rose-400 hover:scale-[1.01] transition-transform text-white text-xs font-bold rounded-lg mt-1 shadow-lg"
                                        >
                                            출금 요청 제출
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 출금 승인/반여 대기열 & 입금 컨펌 진행 상황 */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* 출금 대기열 */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight size={16} className="text-rose-400" />
                                            <span>출금 승인 및 반려 대기열</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">대기 및 브로드캐스트 상태 목록</span>
                                    </div>
                                    <div className="overflow-x-auto min-h-[200px] max-h-[350px]">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-white/5 text-slate-400 font-bold">
                                                    <th className="py-2.5">ID</th>
                                                    <th>UID</th>
                                                    <th>통화</th>
                                                    <th>출금 수량</th>
                                                    <th>수신 주소</th>
                                                    <th>컨펌</th>
                                                    <th>상태</th>
                                                    <th className="text-right">액션</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                                                {cryptoWithdrawals.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="py-8 text-center text-slate-500 font-semibold">대기 중인 출금 요청이 없습니다.</td>
                                                    </tr>
                                                ) : (
                                                    cryptoWithdrawals.map((w: any) => (
                                                        <tr key={w.withdrawalId} className="hover:bg-white/2 transition-colors">
                                                            <td className="py-3 font-mono text-slate-500">{w.withdrawalId}</td>
                                                            <td className="font-mono text-slate-400">{w.userId}</td>
                                                            <td className="font-bold text-white">{w.currency}</td>
                                                            <td className="font-mono text-white">{w.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                                            <td className="font-mono text-slate-500 text-[10px] break-all max-w-[120px]" title={w.toAddress}>{w.toAddress?.slice(0, 10)}...</td>
                                                            <td className="font-mono text-slate-400">
                                                                {w.status === 'BROADCASTED' ? `${w.confirmations} / ${w.currency === 'BTC' ? btcConfirmations : w.currency === 'ETH' || w.currency === 'JAF' ? ethConfirmations : adaConfirmations}` : '-'}
                                                            </td>
                                                            <td>
                                                                {w.status === 'PENDING' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">승인대기</span>
                                                                )}
                                                                {w.status === 'BROADCASTED' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe] animate-pulse">브로드캐스트</span>
                                                                )}
                                                                {(w.status === 'COMPLETED' || w.status === 'SUCCESS') && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">완료됨</span>
                                                                )}
                                                                {w.status === 'REJECTED' && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">반려됨</span>
                                                                )}
                                                            </td>
                                                            <td className="text-right">
                                                                {w.status === 'PENDING' ? (
                                                                    <div className="flex justify-end gap-1.5">
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm(`${w.withdrawalId}번 출금 요청을 승인하시겠습니까?`)) {
                                                                                    await approveWithdrawal(w.withdrawalId);
                                                                                }
                                                                            }}
                                                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all"
                                                                        >
                                                                            승인
                                                                        </button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm(`${w.withdrawalId}번 출금 요청을 반려하시겠습니까?`)) {
                                                                                    await rejectWithdrawal(w.withdrawalId);
                                                                                }
                                                                            }}
                                                                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all"
                                                                        >
                                                                            반려
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-500 font-bold">-</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 온체인 입금 모니터링 (Simulated Deposits) */}
                                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ArrowDownRight size={16} className="text-emerald-400" />
                                            <span>실시간 온체인 입금 모니터링 (컨펌 단계)</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">가상 블록체인 입금 감지</span>
                                    </div>
                                    <div className="overflow-x-auto min-h-[200px] max-h-[350px]">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-white/5 text-slate-400 font-bold">
                                                    <th className="py-2.5">TXID</th>
                                                    <th>수신 주소</th>
                                                    <th>통화</th>
                                                    <th>수량</th>
                                                    <th>진행 블록 컨펌 수</th>
                                                    <th className="text-right">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                                                {pendingDeposits.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="py-8 text-center text-slate-500 font-semibold">대기 중이거나 진행 중인 입금 트랜잭션이 없습니다.</td>
                                                    </tr>
                                                ) : (
                                                    pendingDeposits.map((d: any) => (
                                                        <tr key={d.txHash} className="hover:bg-white/2 transition-colors">
                                                            <td className="py-3 font-mono text-slate-500 text-[10px] break-all max-w-[120px]" title={d.txHash}>{d.txHash?.slice(0, 15)}...</td>
                                                            <td className="font-mono text-slate-400 text-[10px] break-all max-w-[100px]" title={d.cryptoAddress}>{d.cryptoAddress?.slice(0, 10)}...</td>
                                                            <td className="font-bold text-white">{d.currency}</td>
                                                            <td className="font-mono text-white">{d.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                                            <td className="font-mono">
                                                                <span className="text-[#00f2fe] font-black">{d.confirmations}</span>
                                                                <span className="text-slate-500 font-bold"> / {d.currency === 'BTC' ? btcConfirmations : d.currency === 'ETH' || d.currency === 'JAF' ? ethConfirmations : adaConfirmations}</span>
                                                            </td>
                                                            <td className="text-right">
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#00f2fe]/10 border border-[#00f2fe]/20 text-[#00f2fe] animate-pulse">컨펌 진행 중</span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* 3. 사용자 온체인 주소 목록 */}
                            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center gap-2">
                                    <Users size={16} className="text-[#00f2fe]" />
                                    <span>회원 온체인 입금 주소 데이터베이스</span>
                                </div>
                                <div className="overflow-x-auto max-h-[300px]">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-white/5 text-slate-400 font-bold">
                                                <th className="py-2.5">UID</th>
                                                <th>회원 이메일</th>
                                                <th>구분</th>
                                                <th>온체인 지갑 주소</th>
                                                <th>주소 생성 일시</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 font-medium text-slate-300">
                                            {userCryptoAddresses.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold">발급된 온체인 주소가 없습니다.</td>
                                                </tr>
                                            ) : (
                                                userCryptoAddresses.map((addr: any, index: number) => (
                                                    <tr key={index} className="hover:bg-white/2 transition-colors">
                                                        <td className="py-3 font-mono text-slate-400">{addr.userId}</td>
                                                        <td className="text-white font-bold">{addr.userEmail}</td>
                                                        <td className="font-bold text-[#00f2fe]">{addr.currency}</td>
                                                        <td className="font-mono text-slate-300 break-all">{addr.address}</td>
                                                        <td className="font-mono text-slate-500">{new Date(addr.createdAt).toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 6: SYSTEM SETTINGS (시스템 환경 설정) */}
                </main>
            </>
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
