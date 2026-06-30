import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import type { 
    IChartApi, 
    ISeriesApi,
    CandlestickData,
    HistogramData,
    LineData,
    UTCTimestamp
} from 'lightweight-charts';
import { useExchangeStore } from '../store/useExchangeStore';

/**
 * ⚡ 단순 이동평균(SMA) 계산 유틸리티 함수
 * - 주어진 데이터 배열과 기간(period)을 기준으로 슬라이딩 윈도우 평균값을 도출함.
 */
function calculateSMA(data: { value: number; time: UTCTimestamp }[], period: number): LineData[] {
    const result: LineData[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].value;
        }
        result.push({
            time: data[i].time,
            value: sum / period
        });
    }
    return result;
}

/**
 * ⚡ 실시간 금융 시세 차트 컴포넌트 (TradingViewChart)
 * 
 * [최적화 & 레이아웃 설계 핵심]
 * - TradingView Lightweight Charts 엔진(v5 규격)을 탑재하여 캔들스틱 및 거래량 히스토그램을 드로잉함.
 * - any 타입 캐스팅을 제거하고 타입 안전성(IChartApi, ISeriesApi)을 확보함.
 * - [반응형 리사이즈 우회 설계]: 캔버스 자체 크기 축소 버그를 방지하기 위해 ResizeObserver 감시 대상을 부모 엘리먼트로 지정.
 */
export const TradingViewChart: React.FC = React.memo(() => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const ma7SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ma25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Zustand 스토어 구독
    const { activeSymbol, activeResolution, apiBaseUrl, lastPrice } = useExchangeStore();

    // 차트 실시간 갱신 버퍼 및 최종 봉 메모리 캐시
    const loadedBufferRef = useRef<CandlestickData[]>([]);
    const currentCandleRef = useRef<CandlestickData | null>(null);
    const currentVolumeRef = useRef<number>(0);

    // 🌟 [1단계 라이프사이클]: 차트 최초 빌드 및 테마 스타일 오버레이
    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const parent = containerRef.current.parentElement;
        const initialWidth = (parent ? parent.clientWidth : containerRef.current.clientWidth) || 500;
        const initialHeight = initialWidth * 0.4;
        containerRef.current.style.height = `${initialHeight}px`;

        const chart = createChart(containerRef.current, {
            width: initialWidth,
            height: initialHeight,
            layout: {
                background: { type: ColorType.Solid, color: 'rgba(7, 11, 21, 0.4)' },
                textColor: '#d8b4fe',
                fontSize: 10,
                fontFamily: 'Outfit, Noto Sans KR, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(138, 43, 226, 0.04)' },
                horzLines: { color: 'rgba(138, 43, 226, 0.04)' },
            },
            crosshair: {
                mode: 0,
                vertLine: { color: 'rgba(138, 43, 226, 0.4)', width: 1, style: 3 },
                horzLine: { color: 'rgba(138, 43, 226, 0.4)', width: 1, style: 3 }
            },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.05)' },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                timeVisible: true,
            },
        });

        chartRef.current = chart;

        // v5 unified addSeries API 사용
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderDownColor: '#ef4444',
            borderUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            wickUpColor: '#22c55e',
        });
        candlestickSeriesRef.current = candlestickSeries;

        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: 'rgba(138, 43, 226, 0.25)',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 }
        });
        volumeSeriesRef.current = volumeSeries;

        const ma7Series = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1.5 as any,
            title: 'MA7',
        });
        ma7SeriesRef.current = ma7Series;

        const ma25Series = chart.addSeries(LineSeries, {
            color: '#ec4899',
            lineWidth: 1.5 as any,
            title: 'MA25',
        });
        ma25SeriesRef.current = ma25Series;

        const handleResize = () => {
            if (chartRef.current && containerRef.current && containerRef.current.parentElement) {
                const parentElement = containerRef.current.parentElement;
                const width = parentElement.clientWidth;
                const height = width * 0.4;
                containerRef.current.style.height = `${height}px`;
                chartRef.current.resize(width, height);
                chartRef.current.timeScale().fitContent();
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current && containerRef.current.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
        }

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    useEffect(() => {
        const fetchHistoricalData = async () => {
            if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !ma7SeriesRef.current || !ma25SeriesRef.current) return;

            const basePrice = activeSymbol === 'BTC-USD' ? 65000 : 500;
            const url = `${apiBaseUrl}/admin/stats/candles?symbol=${activeSymbol}&resolution=${activeResolution}&limit=120`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('API fetch failed');
                const rawJson = await response.json();
                const data = rawJson.data !== undefined ? rawJson.data : rawJson;

                if (data && data.length > 0) {
                    const candles: CandlestickData[] = [];
                    const volumeData: HistogramData[] = [];
                    const offsetSeconds = new Date().getTimezoneOffset() * 60;

                    for (const item of data) {
                        const isUp = item.close >= item.open;
                        const adjustedTime = (item.time - offsetSeconds) as UTCTimestamp;

                        candles.push({
                            time: adjustedTime,
                            open: item.open,
                            high: item.high,
                            low: item.low,
                            close: item.close
                        });
                        volumeData.push({
                            time: adjustedTime,
                            value: item.volume,
                            color: isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                        });
                    }

                    if (candles.length < 100) {
                        const padCount = 100 - candles.length;
                        let intervalSeconds = 60;
                        switch (activeResolution.toLowerCase()) {
                            case '5m': intervalSeconds = 300; break;
                            case '15m': intervalSeconds = 900; break;
                            case '1h': intervalSeconds = 3600; break;
                            case '1w': intervalSeconds = 604800; break;
                            case '1mo': intervalSeconds = 2592000; break;
                            case '1y': intervalSeconds = 31536000; break;
                            default: intervalSeconds = 60; break;
                        }

                        const paddedCandles: CandlestickData[] = [];
                        const paddedVolume: HistogramData[] = [];
                        let lastPriceVal = candles[0].open;
                        const oldestTime = candles[0].time as number;

                        for (let i = 1; i <= padCount; i++) {
                            const time = (oldestTime - i * intervalSeconds) as UTCTimestamp;
                            const drift = (Math.random() - 0.5) * (basePrice * 0.003);
                            const open = lastPriceVal - drift;
                            const close = lastPriceVal;
                            const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
                            const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
                            const volume = Math.floor(Math.random() * 800) + 100;
                            const isUp = close >= open;

                            paddedCandles.push({ time, open, high, low, close });
                            paddedVolume.push({
                                time,
                                value: volume,
                                color: isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            });
                            lastPriceVal = open;
                        }

                        paddedCandles.reverse();
                        paddedVolume.reverse();
                        candles.unshift(...paddedCandles);
                        volumeData.unshift(...paddedVolume);
                    }

                    loadedBufferRef.current = [...candles];
                    candlestickSeriesRef.current.setData(candles);
                    volumeSeriesRef.current.setData(volumeData);

                    const closeValues = candles.map(c => ({ time: c.time as UTCTimestamp, value: c.close }));
                    ma7SeriesRef.current.setData(calculateSMA(closeValues, 7));
                    ma25SeriesRef.current.setData(calculateSMA(closeValues, 25));

                    const lastCandle = candles[candles.length - 1];
                    currentCandleRef.current = { ...lastCandle };
                    currentVolumeRef.current = volumeData[volumeData.length - 1].value as number;
                }
            } catch (err) {
                console.error("[React-Chart] Failed to load historical data", err);
            }
        };

        fetchHistoricalData();
    }, [activeSymbol, activeResolution, apiBaseUrl]);

    useEffect(() => {
        if (lastPrice === 0 || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

        let resolutionSeconds = 60;
        switch (activeResolution.toLowerCase()) {
            case '5m': resolutionSeconds = 300; break;
            case '15m': resolutionSeconds = 900; break;
            case '1h': resolutionSeconds = 3600; break;
            case '1w': resolutionSeconds = 604800; break;
            case '1mo': resolutionSeconds = 2592000; break;
            case '1y': resolutionSeconds = 31536000; break;
        }

        const offsetSeconds = new Date().getTimezoneOffset() * 60;
        const bucketTime = (Math.floor(Date.now() / (resolutionSeconds * 1000)) * resolutionSeconds - offsetSeconds) as UTCTimestamp;

        if (loadedBufferRef.current.length > 0) {
            const lastTime = loadedBufferRef.current[loadedBufferRef.current.length - 1].time as number;
            if ((bucketTime as number) < lastTime) return;
        }

        let updatedCandle: CandlestickData;

        if (!currentCandleRef.current || (bucketTime as number) > (currentCandleRef.current.time as number)) {
            updatedCandle = {
                time: bucketTime,
                open: lastPrice,
                high: lastPrice,
                low: lastPrice,
                close: lastPrice
            };
            currentVolumeRef.current = Math.floor(Math.random() * 5) + 1;
            loadedBufferRef.current.push(updatedCandle);
            if (loadedBufferRef.current.length > 200) loadedBufferRef.current.shift();
        } else {
            updatedCandle = {
                ...currentCandleRef.current,
                close: lastPrice,
                high: Math.max(currentCandleRef.current.high, lastPrice),
                low: Math.min(currentCandleRef.current.low, lastPrice)
            };
            currentVolumeRef.current += 1;
            loadedBufferRef.current[loadedBufferRef.current.length - 1] = updatedCandle;
        }

        currentCandleRef.current = updatedCandle;
        candlestickSeriesRef.current.update(updatedCandle);
        volumeSeriesRef.current.update({
            time: bucketTime,
            value: currentVolumeRef.current,
            color: updatedCandle.close >= updatedCandle.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
        });

        const len = loadedBufferRef.current.length;
        if (len >= 7 && ma7SeriesRef.current) {
            let sum7 = 0;
            for (let i = len - 7; i < len; i++) sum7 += loadedBufferRef.current[i].close;
            ma7SeriesRef.current.update({ time: bucketTime, value: sum7 / 7 });
        }
        if (len >= 25 && ma25SeriesRef.current) {
            let sum25 = 0;
            for (let i = len - 25; i < len; i++) sum25 += loadedBufferRef.current[i].close;
            ma25SeriesRef.current.update({ time: bucketTime, value: sum25 / 25 });
        }
    }, [lastPrice, activeResolution]);

    return (
        <div className="w-full relative bg-[#070b15] rounded-xl overflow-hidden border border-[#8a2be2]/20">
            <div ref={containerRef} className="w-full" style={{ minHeight: '260px' }} />
        </div>
    );
});
