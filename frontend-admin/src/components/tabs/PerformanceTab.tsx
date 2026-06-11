import React, { useState, useEffect } from 'react';
import { useExchangeStore } from '../../store/useExchangeStore';
import { Activity } from 'lucide-react';

export const PerformanceTab: React.FC = () => {
    const {
        fetchPerformanceStats
    } = useExchangeStore();

    const [performanceStats, setPerformanceStats] = useState<any>(null);

    useEffect(() => {
        const loadPerformance = async () => {
            const data = await fetchPerformanceStats();
            if (data) {
                setPerformanceStats(data);
            }
        };
        loadPerformance();
        const interval = setInterval(loadPerformance, 5000);
        return () => clearInterval(interval);
    }, [fetchPerformanceStats]);

    return (
        <div className="tab-panel animate-fade-in flex flex-col gap-6">
            <div className="section-title text-xl font-black text-white flex items-center gap-2">
                <Activity size={20} className="text-[#8a2be2]" />
                <span>거래소 실적 분석 콘솔 (Performance Console)</span>
            </div>

            {/* Row 1: Fee Revenue Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card-custom p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl flex flex-col justify-between min-h-[140px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">누적 수수료 수익 (Cumulative Fee)</div>
                        <div className="text-lg xl:text-xl tracking-tight font-black font-mono text-emerald-400 mt-2">
                            ${(performanceStats?.feeRevenue?.btcUsdFeesUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-base xl:text-lg tracking-tight font-black font-mono text-amber-500 mt-1">
                            ₩{(performanceStats?.feeRevenue?.adaKrwFeesKrw || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 border-t border-white/5 pt-1.5 mt-2">
                        BTC-USD 및 ADA-KRW 마켓 누적 합산
                    </div>
                </div>

                <div className="card-custom p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl flex flex-col justify-between min-h-[140px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">24H 수수료 수익 (24H Fee)</div>
                        <div className="text-lg xl:text-xl tracking-tight font-black font-mono text-emerald-400 mt-2">
                            ${(performanceStats?.feeRevenue?.btcUsdFees24hUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-base xl:text-lg tracking-tight font-black font-mono text-amber-500 mt-1">
                            ₩{(performanceStats?.feeRevenue?.adaKrwFees24hKrw || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 border-t border-white/5 pt-1.5 mt-2">
                        최근 24시간 동안 수수료율 기반 누적액
                    </div>
                </div>

                <div className="card-custom p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl flex flex-col justify-between min-h-[140px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">24H / 30D 활성 유저 (DAU / MAU)</div>
                        <div className="text-xl xl:text-2xl tracking-tight font-black font-mono text-white mt-2">
                            {(performanceStats?.activeUsers?.dau24h || 0).toLocaleString()} / {(performanceStats?.activeUsers?.mau30d || 0).toLocaleString()} 명
                        </div>
                        <div className="text-xs xl:text-sm font-bold text-[#00f2fe] mt-1">
                            DAU/MAU 비율: {performanceStats?.activeUsers?.dauMauRatioPercent || 0}%
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 border-t border-white/5 pt-1.5 mt-2">
                        주문 생성 및 원장 이력이 있는 고유 사용자 수
                    </div>
                </div>

                <div className="card-custom p-5 bg-slate-900/40 border border-[#8a2be2]/20 rounded-2xl flex flex-col justify-between min-h-[140px]">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">자산 유통 속도 (30D Trading Velocity)</div>
                        <div className="text-xl xl:text-2xl tracking-tight font-black font-mono text-white mt-2">
                            {performanceStats?.tradingVelocity?.velocityPercent || 0}%
                        </div>
                        <div className="text-[10px] xl:text-xs tracking-tighter text-slate-400 mt-1 truncate">
                            총자산: ₩{(performanceStats?.tradingVelocity?.totalUserAssetsKrwEquivalent || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 border-t border-white/5 pt-1.5 mt-2">
                        보유 자산 대비 최근 30일 누적 거래량 비율
                    </div>
                </div>
            </div>

            {/* Row 2: Charts and Detailed Tables */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left/Middle: Net Flow and Order Efficiency */}
                <div className="xl:col-span-2 flex flex-col gap-6">
                    {/* 30D 순입금 흐름 */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                        <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                            최근 30일 통화별 순입금 흐름 (Net Deposit Flow)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(performanceStats?.netDepositFlow30d || []).map((flow: any) => {
                                const isPositive = flow.netFlow >= 0;
                                return (
                                    <div key={flow.currency} className="p-4 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-white">{flow.currency} 순흐름</span>
                                            <span className="text-[10px] text-slate-400">입금액 - 출금액 합산</span>
                                        </div>
                                        <div className={`text-base font-black font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {isPositive ? '+' : ''}{flow.netFlow.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                        </div>
                                    </div>
                                );
                            })}
                            {(!performanceStats?.netDepositFlow30d || performanceStats.netDepositFlow30d.length === 0) && (
                                <div className="col-span-2 text-center py-6 text-slate-500 text-xs">순입금 흐름 데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>

                    {/* 오더 효율성 지표 */}
                    <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                        <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                            최근 30일 주문 체결 효율성 (Order Efficiency)
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">체결 주문 (Filled)</span>
                                <span className="text-lg font-black font-mono text-emerald-400 mt-1">
                                    {(performanceStats?.orderEfficiency?.filledCount || 0).toLocaleString()}건
                                </span>
                            </div>
                            <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">취소 주문 (Cancelled)</span>
                                <span className="text-lg font-black font-mono text-rose-400 mt-1">
                                    {(performanceStats?.orderEfficiency?.cancelledCount || 0).toLocaleString()}건
                                </span>
                            </div>
                            <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">활성 오더북 (Active)</span>
                                <span className="text-lg font-black font-mono text-blue-400 mt-1">
                                    {(performanceStats?.orderEfficiency?.activeCount || 0).toLocaleString()}건
                                </span>
                            </div>
                            <div className="p-3.5 bg-slate-950/40 border border-white/5 rounded-xl flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">오더 체결 성공률</span>
                                <span className="text-lg font-black font-mono text-[#00f2fe] mt-1">
                                    {performanceStats?.orderEfficiency?.fillRatePercent || 0}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-emerald-500 to-[#00f2fe] h-full rounded-full transition-all duration-500" 
                                style={{ width: `${performanceStats?.orderEfficiency?.fillRatePercent || 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Competitor Benchmarking */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2">
                        타거래소 벤치마킹 분석 (Competitor Benchmarking)
                    </div>
                    <div className="flex flex-col gap-4">
                        {(performanceStats?.competitors || []).map((comp: any, idx: number) => {
                            const isSelf = comp.exchange.includes("HFX");
                            return (
                                <div 
                                    key={idx} 
                                    className={`p-4 rounded-xl border flex flex-col gap-2 transition-all duration-300 ${isSelf ? 'bg-[#8a2be2]/10 border-[#8a2be2]/30 shadow-lg' : 'bg-slate-950/40 border-white/5 hover:border-white/10'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-xs font-black ${isSelf ? 'text-[#c084fc]' : 'text-white'}`}>{comp.exchange}</span>
                                        {isSelf && (
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-[#8a2be2]/20 border border-[#8a2be2]/40 text-[#c084fc]">
                                                OURS
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-400">
                                        <div>
                                            수수료율 (BTC / ADA): <span className="text-white font-bold">{comp.btcUsdFeeRatePercent}% / {comp.adaKrwFeeRatePercent}%</span>
                                        </div>
                                        <div>
                                            평균 지연시간: <span className="text-white font-bold">{comp.avgLatencyMs}ms</span>
                                        </div>
                                        <div>
                                            엔진 TPS: <span className="text-white font-bold">{(comp.tps || 0).toLocaleString()} TPS</span>
                                        </div>
                                        <div>
                                            시스템 가동률: <span className="text-emerald-400 font-bold">{comp.reliabilityPercent}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!performanceStats?.competitors || performanceStats.competitors.length === 0) && (
                            <div className="text-center py-6 text-slate-500 text-xs">벤치마킹 데이터가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
