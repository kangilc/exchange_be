import React from 'react';
import { useExchangeStore, type TradeLog } from '../../store/useExchangeStore';
import { TradingViewChart } from '../TradingViewChart';
import { MonitorPlay, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

const PriceCell: React.FC<{ price: number; symbol: string }> = ({ price, symbol }) => {
    const prevPriceRef = React.useRef<number>(price);
    const [flashClass, setFlashClass] = React.useState<string>('');

    React.useEffect(() => {
        if (price !== prevPriceRef.current) {
            const isUp = price > prevPriceRef.current;
            const newClass = isUp ? 'flash-bid-inc' : 'flash-ask-inc';
            setFlashClass(newClass);
            const timer = setTimeout(() => setFlashClass(''), 450);
            prevPriceRef.current = price;
            return () => clearTimeout(timer);
        }
    }, [price]);

    return (
        <span className={`transition-all duration-150 rounded px-1.5 py-0.5 ${flashClass}`}>
            {price.toLocaleString(undefined, { minimumFractionDigits: symbol === 'BTC-USD' ? 2 : 0 })}
        </span>
    );
};


interface MarketWatchTabProps {
    isStreamingPaused: boolean;
    setIsStreamingPaused: React.Dispatch<React.SetStateAction<boolean>>;
    frozenTradesLog: TradeLog[];
    marketConfigs: any;
    setMarketConfigs: React.Dispatch<React.SetStateAction<any>>;
    webGenLogs: string[];
    setWebGenLogs: React.Dispatch<React.SetStateAction<string[]>>;
}

export const MarketWatchTab: React.FC<MarketWatchTabProps> = ({
    isStreamingPaused,
    setIsStreamingPaused,
    frozenTradesLog,
    marketConfigs,
    setMarketConfigs,
    webGenLogs,
    setWebGenLogs
}) => {
    const {
        activeSymbol,
        activeResolution,
        lastPrice,
        totalTradesCount,
        setActiveSymbol,
        setActiveResolution,
        markets,
        fetchMarkets,
        tickerPrices
    } = useExchangeStore();

    React.useEffect(() => {
        fetchMarkets();
    }, [fetchMarkets]);

    const [showLogConsole, setShowLogConsole] = React.useState(true);

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
                        {(['1m', '5m', '15m', '1h', '1w', '1mo', '1y'] as const).map((res) => (
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

            {/* Split Layout: Chart + Summary + Market List */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Chart Area */}
                <div className="xl:col-span-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-sm font-bold text-white">{activeSymbol} 실시간 시세 차트</span>
                        <span className="text-[10px] text-slate-400">MA7, MA25 및 볼륨 지표 오버레이</span>
                    </div>
                    <TradingViewChart />
                </div>

                {/* Core Summary Card */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-5 h-full xl:col-span-1">
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

                {/* Real-time Market List */}
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl flex flex-col h-full overflow-hidden min-h-[350px] xl:col-span-1">
                    <div className="p-4 border-b border-white/5 bg-white/2 text-sm font-extrabold text-white flex justify-between items-center">
                        <span>실시간 마켓 목록</span>
                        <span className="text-[10px] text-slate-500 font-medium">클릭 시 마켓 전환</span>
                    </div>
                    <div className="flex-1 overflow-y-auto w-full bg-black/10">
                        <table className="w-full text-left text-[10px] font-medium font-mono">
                            <thead className="bg-white/2 text-slate-400 font-bold uppercase tracking-wider text-[9px] sticky top-0 bg-[#0a1020] z-10">
                                <tr>
                                    <th className="px-3 py-3">심볼</th>
                                    <th className="px-3 py-3 text-right">현재가</th>
                                    <th className="px-3 py-3 text-right">대비</th>
                                    <th className="px-3 py-3 text-right">거래대금</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-bold">
                                {markets && markets.length > 0 ? (
                                    markets.map((m: any) => {
                                        const isSelected = activeSymbol === m.symbol;
                                        // 대비와 거래대금(24H) Mock 데이터 제공 (추후 API 고도화 대비)
                                        const changePercent = m.symbol === 'BTC-USD' ? -0.25 : (m.symbol === 'ADA-KRW' ? 0.16 : 0.0);
                                        const formattedChange = changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`;
                                        const changeColor = changePercent > 0 ? 'text-emerald-400' : (changePercent < 0 ? 'text-rose-400' : 'text-slate-400');
                                        
                                        // 현재가 조회 (tickerPrices에 실시간 가격이 저장되어 있으면 사용하고, 없으면 basePrice(65000 또는 500) 기준)
                                        let displayPrice = tickerPrices[m.symbol] || (m.symbol === 'BTC-USD' ? 65000 : 500);
                                        
                                        const volumeAmount = m.symbol === 'BTC-USD' ? '32,410,500 USD' : '450,200,000 KRW';

                                        return (
                                            <tr 
                                                key={m.symbol} 
                                                onClick={() => setActiveSymbol(m.symbol)}
                                                className={`hover:bg-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-white/5' : ''}`}
                                            >
                                                <td className="px-3 py-3">
                                                    <span className="text-white block text-[11px]">{m.symbol}</span>
                                                </td>
                                                <td className="px-3 py-3 text-right text-slate-200">
                                                    <PriceCell price={displayPrice} symbol={m.symbol} />
                                                </td>
                                                <td className={`px-3 py-3 text-right ${changeColor}`}>
                                                    {formattedChange}
                                                </td>
                                                <td className="px-3 py-3 text-right text-slate-400">
                                                    {volumeAmount}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="text-center py-6 text-slate-500">마켓 목록을 로딩 중입니다...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* WebSocket Log Monitor */}
            <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-sm font-extrabold text-white">실시간 체결 로그 실황 (WebSocket Binary Stream)</span>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsStreamingPaused(!isStreamingPaused)}
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
                                frozenTradesLog.map((trade: TradeLog, index: number) => {
                                    const isBuy = trade.side === 'BUY';
                                    return (
                                        <tr key={`${trade.tradeId}-${index}`} className="hover:bg-white/2 transition-colors">
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

            {/* 4. 실시간 모의 주문 생성기 설정 (Web Order Generator Settings) - 마켓별 그리드 카드 */}
            <div className="flex flex-col gap-4 mt-6">
                <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MonitorPlay size={16} className="text-[#00f2fe]" />
                        <span>실시간 모의 주문 생성기 설정 (Web Order Generator Settings)</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowLogConsole(!showLogConsole)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${showLogConsole ? 'bg-rose-500/10 border-rose-500/35 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20'}`}
                    >
                        {showLogConsole ? '로그 콘솔 숨기기' : '로그 콘솔 표시하기'}
                    </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {Object.values(marketConfigs).map((config: any) => (
                        <div key={config.symbol} className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                            {/* 마켓별 헤더 */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <span className="text-sm font-extrabold text-white">{config.name}</span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                        <span className={`w-2 h-2 rounded-full ${config.active ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                                        <span className={config.active ? 'text-emerald-400' : 'text-rose-400'}>
                                            {config.active ? 'RUNNING' : 'STOPPED'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMarketConfigs((prev: any) => ({
                                                ...prev,
                                                [config.symbol]: {
                                                    ...prev[config.symbol],
                                                    active: !config.active
                                                }
                                            }));
                                        }}
                                        className={`px-4 py-1.5 rounded-lg font-extrabold text-[11px] text-white transition-all active:scale-95 ${config.active ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-[#8a2be2] to-[#00f2fe]'}`}
                                    >
                                        {config.active ? '정지' : '시작'}
                                    </button>
                                </div>
                            </div>

                            {/* 설정 필드 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-300">
                                {/* side */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 방향 (Side)</label>
                                    <select 
                                        value={config.side}
                                        onChange={(e) => {
                                            setMarketConfigs((prev: any) => ({
                                                ...prev,
                                                [config.symbol]: {
                                                    ...prev[config.symbol],
                                                    side: e.target.value as any
                                                }
                                            }));
                                        }}
                                        className="p-2.5 bg-slate-950 border border-white/10 rounded-lg text-white font-bold outline-none focus:border-[#8a2be2]"
                                    >
                                        <option value="RANDOM">RANDOM (매수/매도 반반)</option>
                                        <option value="BUY">BUY (매수 전용)</option>
                                        <option value="SELL">SELL (매도 전용)</option>
                                    </select>
                                </div>

                                {/* interval */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 생성 주기 (속도)</label>
                                    <select 
                                        value={config.interval}
                                        onChange={(e) => {
                                            setMarketConfigs((prev: any) => ({
                                                ...prev,
                                                [config.symbol]: {
                                                    ...prev[config.symbol],
                                                    interval: Number(e.target.value)
                                                }
                                            }));
                                        }}
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

                                {/* price range */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 가격 범위 (Min ~ Max)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={config.minPrice} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        minPrice: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최소" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                        <span className="text-slate-500">~</span>
                                        <input 
                                            type="number" 
                                            value={config.maxPrice} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        maxPrice: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최대" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                    </div>
                                </div>

                                {/* qty range */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 수량 범위 (Min ~ Max)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={config.minQty} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        minQty: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최소" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                        <span className="text-slate-500">~</span>
                                        <input 
                                            type="number" 
                                            value={config.maxQty} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        maxQty: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최대" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                    </div>
                                </div>

                                {/* user id range */}
                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                    <label className="text-slate-400 uppercase text-[10px]">주문 유저 UID 범위 (Min ~ Max)</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={config.minUserId} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        minUserId: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최소" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                        <span className="text-slate-500">~</span>
                                        <input 
                                            type="number" 
                                            value={config.maxUserId} 
                                            onChange={(e) => {
                                                setMarketConfigs((prev: any) => ({
                                                    ...prev,
                                                    [config.symbol]: {
                                                        ...prev[config.symbol],
                                                        maxUserId: e.target.value
                                                    }
                                                }));
                                            }}
                                            placeholder="최대" 
                                            className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white font-mono text-center outline-none focus:border-[#8a2be2]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. 실시간 모의 주문 생성 로그 콘솔 (Web Order Generator Log Console) */}
            {showLogConsole && (
                <div className="bg-[#0a1020]/45 border border-white/5 rounded-2xl p-6 flex flex-col gap-4 mt-6">
                    <div className="text-sm font-extrabold text-white border-b border-white/5 pb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-[#00f2fe]" />
                            <span>실시간 모의 주문 생성 로그 콘솔 (Web Order Generator Logs)</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setWebGenLogs([])}
                            className="px-4 py-1.5 border border-white/10 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-all"
                        >
                            로그 비우기
                        </button>
                    </div>
                    <div style={{ display: 'block', width: '100%' }}>
                        <textarea
                            readOnly
                            value={webGenLogs.length === 0 ? '생성기가 대기중입니다. 시작 버튼을 클릭해 주세요.' : webGenLogs.join('\n')}
                            style={{
                                height: '240px',
                                width: '100%',
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: '12px',
                                padding: '12px',
                                boxSizing: 'border-box',
                                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                fontSize: '11px',
                                lineHeight: '1.6',
                                color: '#cbd5e1',
                                resize: 'none',
                                outline: 'none',
                                display: 'block'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
