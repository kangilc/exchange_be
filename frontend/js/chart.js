// 🌌 TradingView Lightweight Candlestick Charts Integration Module
import { state } from './state.js';

let chart = null;
let candlestickSeries = null;
let volumeSeries = null;
let container = null;

let currentCandle = null;
let currentVolume = 0;

export function initChart() {
    container = document.getElementById('tv-chart-container');
    if (!container) return;

    // Clean up container before recreating
    container.innerHTML = '';

    // Create high-performance TradingView chart instance with premium glassmorphic options
    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { type: 'solid', color: 'rgba(9, 14, 26, 0.1)' },
            textColor: '#94a3b8',
            fontSize: 10,
            fontFamily: 'Outfit, Noto Sans KR, sans-serif',
        },
        grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.025)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.025)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                color: 'rgba(0, 242, 254, 0.4)',
                width: 1,
                style: 3, // dashed
                labelBackgroundColor: '#00f2fe',
            },
            horzLine: {
                color: 'rgba(0, 242, 254, 0.4)',
                width: 1,
                style: 3, // dashed
                labelBackgroundColor: '#00f2fe',
            }
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.06)',
            visible: true,
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.06)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    // Add Candlestick series
    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        wickUpColor: '#22c55e',
    });

    // Add Volume histogram series overlayed at the bottom
    volumeSeries = chart.addHistogramSeries({
        color: 'rgba(59, 130, 246, 0.3)',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '', // Overlay style
    });

    volumeSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.8, // keeps volume chart tucked nicely at the bottom 20%
            bottom: 0,
        },
    });

    // Seed mock data initially
    const basePrice = state.currentSymbol === 'BTC-USD' ? 65000 : 500;
    seedHistoricalCandles(basePrice);

    // Dynamic resize handler
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 200);
}

export function resizeCanvas() {
    if (!chart || !container) return;
    const rect = container.getBoundingClientRect();
    chart.resize(rect.width, rect.height || 330);
}

/**
 * Seeds beautiful mock 1-minute historical OHLCV data to fill the canvas on startup
 */
export function seedHistoricalCandles(basePrice) {
    if (!candlestickSeries || !volumeSeries) return;

    const candles = [];
    const volumeData = [];
    let lastPrice = basePrice;
    
    // Correct for local browser timezone offset (Lightweight Charts renders internally as UTC)
    const offsetSeconds = new Date().getTimezoneOffset() * 60;

    // Generate 100 historical minute bars
    for (let i = 100; i >= 0; i--) {
        const time = Math.floor((Date.now() - i * 60 * 1000) / 60000) * 60 - offsetSeconds;
        const open = lastPrice;
        const drift = (Math.random() - 0.5) * (basePrice * 0.003);
        const close = lastPrice + drift;
        const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
        const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
        const volume = Math.floor(Math.random() * 800) + 100;
        const isUp = close >= open;

        candles.push({ time, open, high, low, close });
        volumeData.push({
            time,
            value: volume,
            color: isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
        });

        lastPrice = close;
    }

    candlestickSeries.setData(candles);
    volumeSeries.setData(volumeData);

    // Retain current running bar state
    const lastCandle = candles[candles.length - 1];
    currentCandle = { ...lastCandle };
    currentVolume = volumeData[volumeData.length - 1].value;
}

/**
 * Aggregates a single real-time transaction-level trade price into the active 1-minute OHLCV candle bar
 */
export function addPriceTick(price) {
    if (!candlestickSeries || !volumeSeries) return;

    const offsetSeconds = new Date().getTimezoneOffset() * 60;
    const minuteTime = Math.floor(Date.now() / 60000) * 60 - offsetSeconds;

    if (!currentCandle || minuteTime > currentCandle.time) {
        // Start a brand new minute candle
        currentCandle = {
            time: minuteTime,
            open: price,
            high: price,
            low: price,
            close: price
        };
        currentVolume = Math.floor(Math.random() * 5) + 1;
    } else {
        // Update the existing 1-minute running candle
        currentCandle.close = price;
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentVolume += 1; // Increment trade count/volume
    }

    // Direct real-time updates to series
    candlestickSeries.update(currentCandle);
    volumeSeries.update({
        time: minuteTime,
        value: currentVolume,
        color: currentCandle.close >= currentCandle.open ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
    });
}

// Kept for backward compatibility mapping
export function drawPriceChart() {}
