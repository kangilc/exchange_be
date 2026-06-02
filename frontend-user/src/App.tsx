import React, { useEffect } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import { TradingTerminal } from './components/TradingTerminal';
import './App.css';

export const App: React.FC = () => {
    const {
        apiBaseUrl,
        wsConnected,
        initStore
    } = useExchangeStore();

    useEffect(() => {
        // 전역 스토어 초기화 및 웹소켓 연결
        initStore();
    }, [initStore]);

    return (
        <div className="app-container min-h-screen text-slate-100 flex flex-col font-sans bg-[#070b15]">
            {/* Top Glowing Header (User Version) */}
            <header className="header-bar flex items-center justify-between px-8 py-4 sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#070b15]/95 shadow-2xl">
                <div className="logo-section flex items-center gap-3">
                    <div className="logo-glow w-4.5 h-4.5 rounded-full bg-gradient-to-r from-[#8a2be2] to-[#00f2fe] shadow-[0_0_15px_#8a2be2]" />
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
                </div>
            </header>

            <div className="flex-1 flex flex-col">
                <TradingTerminal />
            </div>
        </div>
    );
};
