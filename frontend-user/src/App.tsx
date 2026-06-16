import React, { useEffect, useState } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import { TradingTerminal } from './components/TradingTerminal';
import { LogOut, Lock, Mail, X } from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
    const apiBaseUrl = useExchangeStore(state => state.apiBaseUrl);
    const wsConnected = useExchangeStore(state => state.wsConnected);
    const initStore = useExchangeStore(state => state.initStore);
    const isAuthenticated = useExchangeStore(state => state.isAuthenticated);
    const authEmail = useExchangeStore(state => state.authEmail);
    const isLoginModalOpen = useExchangeStore(state => state.isLoginModalOpen);
    const setLoginModalOpen = useExchangeStore(state => state.setLoginModalOpen);
    const login = useExchangeStore(state => state.login);
    const logout = useExchangeStore(state => state.logout);

    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 전역 스토어 초기화 및 웹소켓 연결
        initStore();
    }, [initStore]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleCloseModal();
            }
        };

        if (isLoginModalOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLoginModalOpen]);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setLoading(true);

        const res = await login(emailInput, passwordInput);
        setLoading(false);
        if (!res.success) {
            setLoginError(res.message || '이메일 또는 비밀번호가 올바르지 않습니다.');
        } else {
            setEmailInput('');
            setPasswordInput('');
        }
    };

    const handleCloseModal = () => {
        setLoginModalOpen(false);
        setLoginError('');
        setEmailInput('');
        setPasswordInput('');
    };

    return (
        <div className="app-container min-h-screen text-slate-100 flex flex-col font-sans bg-[#070b15] relative">
            {/* Top Glowing Header (User Version) */}
            <header className="header-bar flex items-center justify-between px-8 py-4 sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#070b15]/95 shadow-2xl">
                <div className="logo-section flex items-center gap-3">
                    <img src="/JavaF_ico.svg" alt="JavaF Logo" className="h-6 object-contain" />
                    <span className="logo-title font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                        JavaF <span className="text-xs logo-badge uppercase border border-[#00f2fe]/40 bg-[#00f2fe]/5 px-1.5 py-0.5 rounded text-[#00f2fe] font-bold tracking-wider ml-1">EXCHANGE CLIENT</span>
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

                    {!isAuthenticated ? (
                        <button
                            onClick={() => setLoginModalOpen(true)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-extrabold hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
                        >
                            로그인
                        </button>
                    ) : (
                        authEmail && (
                            <div className="flex items-center gap-3 border-l border-white/5 pl-4 ml-1">
                                <span className="text-slate-300 font-mono hidden sm:inline">{authEmail}</span>
                                <button
                                    onClick={logout}
                                    title="로그아웃"
                                    className="p-2 rounded-xl bg-white/2 border border-white/5 hover:bg-rose-500/10 hover:border-rose-500/35 hover:text-rose-400 transition-all cursor-pointer"
                                >
                                    <LogOut size={14} />
                                </button>
                            </div>
                        )
                    )}
                </div>
            </header>

            <div className="flex-1 flex flex-col">
                <TradingTerminal />
            </div>

            {/* Footer */}
            <footer className="py-6 flex flex-col items-center gap-2 text-center text-[10px] text-slate-500 font-semibold border-t border-white/5 bg-[#070b15]">
                <img src="/JavaF_logo_tiny_400.png" alt="JavaF Logo" className="w-[400px] max-w-full object-contain" />
                <span>© 2026 JavaF Exchange. All rights reserved.</span>
            </footer>

            {/* 🌌 글로벌 로그인 모달 팝업 */}
            {isLoginModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
                    {/* Background ambient glows inside modal area */}
                    <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-[#8a2be2]/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] bg-[#00f2fe]/10 rounded-full blur-[100px] pointer-events-none" />

                    <div className="w-full max-w-md bg-[#0a1020]/90 border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative animate-scale-up">
                        {/* 닫기 버튼 */}
                        <button
                            onClick={handleCloseModal}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex flex-col items-center gap-3 mb-6 mt-2">
                            <img src="/JavaF_logo_tiny_400.png" alt="JavaF Logo" className="h-10 object-contain mb-1" />
                            <h2 className="font-extrabold text-xl tracking-tight text-white mt-1">JavaF 거래소 로그인</h2>
                            <p className="text-xs text-slate-400 font-medium text-center">모의투자 및 입출금 관리를 위해 계정으로 로그인해 주세요.</p>
                            <p className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">초기 이메일: user1@exchange.com / 비번: password123</p>
                        </div>

                        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5 text-xs font-semibold">
                            {loginError && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-center">
                                    {loginError}
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-400 uppercase text-[10px] tracking-wider">이메일 주소</label>
                                <div className="relative flex items-center">
                                    <Mail size={16} className="absolute left-3.5 text-slate-500" />
                                    <input 
                                        type="email"
                                        required
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        placeholder="your-email@exchange.com"
                                        className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-[#8a2be2] font-mono text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-slate-400 uppercase text-[10px] tracking-wider">비밀번호</label>
                                <div className="relative flex items-center">
                                    <Lock size={16} className="absolute left-3.5 text-slate-500" />
                                    <input 
                                        type="password"
                                        required
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-[#8a2be2] text-sm transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-[#8a2be2] to-[#6366f1] text-white font-extrabold text-sm shadow-xl transition-all hover:scale-[1.01] hover:brightness-110 disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? '로그인 처리 중...' : '거래소 로그인'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
