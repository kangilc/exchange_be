import React, { useEffect, useState } from 'react';
import { useExchangeStore } from './store/useExchangeStore';
import { TradingViewChart } from './components/TradingViewChart';
import { LayoutDashboard, Users, ShieldAlert, MonitorPlay, ArrowDownRight, ArrowUpRight, Activity } from 'lucide-react';
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
        apiBaseUrl
    } = useExchangeStore();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'market-watch'>('market-watch');

    useEffect(() => {
        // 전역 스토어 초기화 및 웹소켓 연결
        initStore();
    }, [initStore]);

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
                {/* Sidebar Navigation */}
                <aside className="w-[260px] bg-[#0a1020]/95 border-r border-white/5 flex flex-col p-6 gap-2 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border ${activeTab === 'dashboard' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <LayoutDashboard size={18} />
                        <span>통합 현황 분석</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('market-watch')}
                        className={`nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 border ${activeTab === 'market-watch' ? 'bg-[#8a2be2]/12 border-[#8a2be2]/20 text-white shadow-lg' : 'border-transparent text-slate-400 hover:bg-white/2 hover:text-white'}`}
                    >
                        <MonitorPlay size={18} />
                        <span>실시간 마켓 감시</span>
                    </button>

                    <div className="nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm border border-transparent text-slate-500 cursor-not-allowed">
                        <Users size={18} />
                        <span>회원 정보 관리 (Legacy)</span>
                    </div>

                    <div className="nav-item flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm border border-transparent text-slate-500 cursor-not-allowed">
                        <ShieldAlert size={18} />
                        <span>원장 감사 로그 (Legacy)</span>
                    </div>
                </aside>

                {/* Main Workspace */}
                <main className="flex-1 p-8 overflow-y-auto max-w-[1600px] flex flex-col gap-6">
                    {activeTab === 'dashboard' && (
                        <div className="tab-panel animate-fade-in flex flex-col gap-6">
                            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                                <LayoutDashboard size={20} className="text-[#8a2be2]" />
                                <span>종합 데이터 대시보드</span>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">실시간 총 체결 카운트</div>
                                    <div className="text-3xl font-black font-mono text-white mt-1">{totalTradesCount.toLocaleString()} 건</div>
                                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold mt-1">
                                        <Activity size={10} />
                                        <span>WebSocket Gateway 연동 중</span>
                                    </div>
                                </div>

                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">감시 마켓 현재가</div>
                                    <div className="text-3xl font-black font-mono text-[#00f2fe] mt-1">{lastPrice > 0 ? formatPrice(lastPrice) : '-'}</div>
                                    <div className="text-[10px] text-slate-400">선택된 통화 마켓 시황 지표</div>
                                </div>

                                <div className="card-custom p-6 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl relative overflow-hidden flex flex-col gap-2">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">24H 시세 변동률</div>
                                    <div className={`text-xl font-black font-mono mt-1.5 ${change24h.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {lastPrice > 0 ? change24h.text : '-'}
                                    </div>
                                    <div className="text-[10px] text-slate-400">전일 시가 대비 실시간 계산수치</div>
                                </div>
                            </div>
                            <div className="p-8 bg-[#0d1426]/60 border border-white/5 rounded-2xl text-center text-slate-400 text-sm">
                                📊 ApexCharts 분석 대시보드는 백엔드 통계 API 연동 후 고도화 구성 예정입니다.
                            </div>
                        </div>
                    )}

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
                                        <span>LIVE STREAMINGING</span>
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
                </main>
            </div>
        </div>
    );
};
