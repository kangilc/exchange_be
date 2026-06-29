import React, { useEffect, useState } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import {
    LayoutDashboard, Users, ShieldAlert, MonitorPlay,
    Activity, X, Settings, Coins
} from 'lucide-react';
import './App.css';

import { DashboardTab } from './components/tabs/DashboardTab';
import { MarketWatchTab } from './components/tabs/MarketWatchTab';
import { UserManagementTab } from './components/tabs/UserManagementTab';
import { WalletManagementTab } from './components/tabs/WalletManagementTab';
import { LedgerHistoryTab } from './components/tabs/LedgerHistoryTab';
import { CustodyManagementTab } from './components/tabs/CustodyManagementTab';
import { PerformanceTab } from './components/tabs/PerformanceTab';
import { SettingsTab } from './components/tabs/SettingsTab';

export const App: React.FC = () => {
    const {
        wsConnected,
        tradesLog,
        initStore,
        apiBaseUrl,
        fetchSummaryStats,
        isAuthenticated,
        login,
        logout,
        authEmail,
        fetchSettings,
        sendWsMessage
    } = useExchangeStore();

    // 탭 변수 확장 ('dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger' | 'settings' | 'custody' | 'performance')
    const [activeTab, setActiveTab] = useState<'dashboard' | 'market-watch' | 'users' | 'wallets' | 'ledger' | 'settings' | 'custody' | 'performance'>('market-watch');

    // 실시간 스트리밍 모니터 일시 정지(Pause) 제어 상태
    const [isStreamingPaused, setIsStreamingPaused] = useState(true);
    const [frozenTradesLog, setFrozenTradesLog] = useState<any[]>([]);

    // 트랜잭션 조회 모달 상태
    const [showTxModal, setShowTxModal] = useState(false);
    const [selectedTxHash, setSelectedTxHash] = useState('');
    const [selectedTxDetails, setSelectedTxDetails] = useState<any>(null);
    const [selectedTxReceipt, setSelectedTxReceipt] = useState<any>(null);

    const handleViewTx = async (txHash: string) => {
        if (!txHash || txHash === '-') return;
        setSelectedTxHash(txHash);
        setSelectedTxDetails(null);
        setSelectedTxReceipt(null);
        setShowTxModal(true);

        try {
            const resTx = await fetch('http://localhost:8545', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getTransactionByHash',
                    params: [txHash],
                    id: 1
                })
            });
            const dataTx = await resTx.json();
            if (dataTx.result) {
                setSelectedTxDetails(dataTx.result);
            }

            const resReceipt = await fetch('http://localhost:8545', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getTransactionReceipt',
                    params: [txHash],
                    id: 2
                })
            });
            const dataReceipt = await resReceipt.json();
            if (dataReceipt.result) {
                setSelectedTxReceipt(dataReceipt.result);
            }
        } catch (e) {
            console.error(e);
        }
    };



    // 웹 기반 실시간 주문 생성 시뮬레이터 (Web Order Generator) 다중 마켓 상태
    interface MarketGenConfig {
        symbol: string;
        name: string;
        active: boolean;
        side: 'BUY' | 'SELL' | 'RANDOM';
        interval: number;
        minPrice: string;
        maxPrice: string;
        minQty: string;
        maxQty: string;
        minUserId: string;
        maxUserId: string;
    }

    const [marketConfigs, setMarketConfigs] = useState<Record<string, MarketGenConfig>>({
        'BTC-USD': {
            symbol: 'BTC-USD',
            name: 'BTC-USD (비트코인)',
            active: false,
            side: 'RANDOM',
            interval: 300,
            minPrice: '64000',
            maxPrice: '65000',
            minQty: '1',
            maxQty: '10',
            minUserId: '1',
            maxUserId: '1000'
        },
        'ADA-KRW': {
            symbol: 'ADA-KRW',
            name: 'ADA-KRW (에이다)',
            active: false,
            side: 'RANDOM',
            interval: 300,
            minPrice: '450',
            maxPrice: '550',
            minQty: '100',
            maxQty: '1000',
            minUserId: '1',
            maxUserId: '1000'
        }
    });

    const [webGenLogs, setWebGenLogs] = useState<string[]>([]);

    // Web Order Generator Loop (N개 마켓 독립 가동)
    useEffect(() => {
        const timers: Record<string, any> = {};

        Object.keys(marketConfigs).forEach((symbol) => {
            const config = marketConfigs[symbol];
            if (!config.active) return;

            const generateOrder = () => {
                const minP = parseFloat(config.minPrice) || 10;
                const maxP = parseFloat(config.maxPrice) || 100;
                const minQ = parseFloat(config.minQty) || 1;
                const maxQ = parseFloat(config.maxQty) || 10;
                const minU = parseInt(config.minUserId) || 1;
                const maxU = parseInt(config.maxUserId) || 1000;

                const side = config.side === 'RANDOM'
                    ? (Math.random() < 0.5 ? 'BUY' : 'SELL')
                    : config.side;

                const price = minP + Math.random() * (maxP - minP);
                const qty = minQ + Math.random() * (maxQ - minQ);
                const userId = minU + Math.floor(Math.random() * (maxU - minU + 1));

                const scaledPrice = Math.round(price * 100);
                const scaledQty = Math.round(qty);

                const payload = {
                    action: 'NEW',
                    symbol: config.symbol,
                    side: side,
                    price: scaledPrice,
                    qty: scaledQty,
                    userId: userId
                };

                const success = sendWsMessage(payload);
                const timeStr = new Date().toTimeString().split(' ')[0];

                if (success) {
                    const logMsg = `[${timeStr}] [${config.symbol}] ${side} 주문 전송: 가격 ${price.toLocaleString(undefined, { minimumFractionDigits: 2 })} / 수량 ${scaledQty} (User: ${userId})`;
                    setWebGenLogs(prev => [logMsg, ...prev].slice(0, 30));
                } else {
                    const logMsg = `[${timeStr}] [${config.symbol}] 주문 전송 실패 (웹소켓 연결 확인 필요)`;
                    setWebGenLogs(prev => [logMsg, ...prev].slice(0, 30));
                }

                timers[symbol] = setTimeout(generateOrder, config.interval);
            };

            timers[symbol] = setTimeout(generateOrder, config.interval);
        });

        return () => {
            Object.values(timers).forEach(timerId => clearTimeout(timerId));
        };
    }, [marketConfigs, sendWsMessage]);

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
                alert('⚠️ 중복 로그인이 감지되어 이전 세션이 로그아웃 되었습니다.');
            } else {
                // alert('로그인 성공');
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



    if (!isAuthenticated) {
        return (
            <div className="min-h-screen text-slate-100 flex items-center justify-center font-sans bg-[#070b15] relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#8a2be2]/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#00f2fe]/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 w-[420px] bg-slate-900/60 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-3">
                        <img src="/JavaF_logo_tiny_400.png" alt="JavaF Logo" />
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
                                        setLoginPassword('admin123!@#');
                                    }}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:bg-[#8a2be2]/20 hover:border-[#8a2be2]/40 hover:text-white transition-all font-bold"
                                >
                                    🔑 기본 관리자 (admin@javaf.net / admin123!@#)
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
                    <img src="/JavaF_ico_tiny_50.png" alt="JavaF Logo" />
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
                            onClick={() => setActiveTab('performance')}
                            className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border whitespace-nowrap ${activeTab === 'performance' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                        >
                            <Activity size={18} />
                            <span>거래소 실적 분석</span>
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
                            <DashboardTab setActiveTab={(tab: any) => setActiveTab(tab)} />
                        )}

                        {/* TAB 2: REAL-TIME MARKET WATCH (실시간 마켓 감시) */}
                        {activeTab === 'market-watch' && (
                            <MarketWatchTab
                                isStreamingPaused={isStreamingPaused}
                                setIsStreamingPaused={setIsStreamingPaused}
                                frozenTradesLog={frozenTradesLog}
                                marketConfigs={marketConfigs}
                                setMarketConfigs={setMarketConfigs}
                                webGenLogs={webGenLogs}
                                setWebGenLogs={setWebGenLogs}
                            />
                        )}

                        {/* TAB 3: USER MANAGEMENT (회원 통합 관리) */}
                        {activeTab === 'users' && (
                            <UserManagementTab />
                        )}

                        {/* TAB 4: WALLET MANAGEMENT (지갑 및 자산 관리) */}
                        {activeTab === 'wallets' && (
                            <WalletManagementTab />
                        )}

                        {/* TAB 5: LEDGER HISTORY (입출금 통합 관리) */}
                        {activeTab === 'ledger' && (
                            <LedgerHistoryTab />
                        )}

                        {/* TAB 6: SYSTEM SETTINGS (시스템 환경 설정) */}
                        {activeTab === 'settings' && (
                            <SettingsTab />
                        )}

                        {/* TAB 7: CUSTODY MANAGEMENT (온체인 입출금 관리) */}
                        {activeTab === 'custody' && (
                            <CustodyManagementTab
                                handleViewTx={handleViewTx}
                            />
                        )}

                        {/* TAB 8: PERFORMANCE ANALYTICS (거래소 실적 분석) */}
                        {activeTab === 'performance' && (
                            <PerformanceTab />
                        )}
                    </main>
                </>
            </div>

            {/* Footer */}
            <footer className="py-6 flex flex-col items-center gap-2 text-center text-[10px] text-slate-500 font-semibold border-t border-white/5 bg-[#070b15]">
                <img src="/JavaF_logo_tiny_400.png" alt="JavaF Logo" className="w-[400px] max-w-full object-contain" />
                <span>© 2026 JavaF Exchange. All rights reserved.</span>
            </footer>

            {/* ======================================================= */}
            {/* MODALS WINDOWS (팝업 모달 시스템) */}
            {/* ======================================================= */}



            {/* Modal 5: Transaction Details (온체인 트랜잭션 정보 조회) */}
            {showTxModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in text-xs font-semibold">
                    <div className="bg-[#0d1426] border border-[#8a2be2]/40 rounded-2xl w-[600px] shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <span className="text-sm font-extrabold text-white">온체인 트랜잭션 세부 정보 조회</span>
                            <button onClick={() => setShowTxModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
                            <div className="flex flex-col gap-1 border-b border-white/5 pb-3">
                                <span className="text-slate-400 text-[10px] uppercase">트랜잭션 해시 (TxHash)</span>
                                <span className="font-mono text-white text-[11px] break-all selection:bg-purple-500">{selectedTxHash}</span>
                            </div>

                            {!selectedTxDetails ? (
                                <div className="py-8 text-center text-slate-500 font-bold flex flex-col items-center gap-2">
                                    <span className="animate-pulse">로컬 EVM 노드(Ganache)로부터 트랜잭션 정보를 조회 중입니다...</span>
                                    <span className="text-[10px] text-slate-600 font-normal">(Ganache 컨테이너가 켜져 있어야 조회가 가능합니다)</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {/* 기본 트랜잭션 정보 */}
                                    <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-white/5 rounded-xl font-mono text-[10px]">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-500 font-bold uppercase">블록 번호 (Block Number)</span>
                                            <span className="text-white font-extrabold">
                                                {selectedTxDetails.blockNumber ? parseInt(selectedTxDetails.blockNumber, 16) : 'Pending'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-500 font-bold uppercase">논스 (Nonce)</span>
                                            <span className="text-white font-extrabold">{parseInt(selectedTxDetails.nonce, 16)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 col-span-2">
                                            <span className="text-slate-500 font-bold uppercase">송신자 주소 (From)</span>
                                            <span className="text-emerald-400 break-all">{selectedTxDetails.from}</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 col-span-2">
                                            <span className="text-slate-500 font-bold uppercase">수신자 주소 (To / Contract)</span>
                                            <span className="text-[#00f2fe] break-all">{selectedTxDetails.to || 'Contract Creation'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-500 font-bold uppercase">전송 금액 (Value)</span>
                                            <span className="text-white font-extrabold">
                                                {parseInt(selectedTxDetails.value, 16) === 0 ? '0 ETH' : `${parseInt(selectedTxDetails.value, 16) / 10 ** 18} ETH`}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-500 font-bold uppercase">가스 한도 (Gas Limit)</span>
                                            <span className="text-white font-extrabold">{parseInt(selectedTxDetails.gas, 16).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* 영수증 정보 */}
                                    {selectedTxReceipt && (
                                        <div className="flex flex-col gap-3 border-t border-white/5 pt-4">
                                            <span className="text-white text-xs font-extrabold">트랜잭션 실행 영수증 (Receipt)</span>
                                            <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-white/5 rounded-xl font-mono text-[10px]">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-slate-500 font-bold uppercase">실행 상태 (Status)</span>
                                                    <span>
                                                        {selectedTxReceipt.status === '0x1' || selectedTxReceipt.status === true ? (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">성공 (SUCCESS)</span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">실패 (FAILED)</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-slate-500 font-bold uppercase">실제 사용된 가스 (Gas Used)</span>
                                                    <span className="text-white font-extrabold">{parseInt(selectedTxReceipt.gasUsed, 16).toLocaleString()}</span>
                                                </div>
                                                {selectedTxReceipt.contractAddress && (
                                                    <div className="flex flex-col gap-1.5 col-span-2">
                                                        <span className="text-slate-500 font-bold uppercase">생성된 CA (Contract Address)</span>
                                                        <span className="text-amber-400 break-all">{selectedTxReceipt.contractAddress}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-white/5 flex justify-end bg-white/2">
                            <button onClick={() => setShowTxModal(false)} className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
