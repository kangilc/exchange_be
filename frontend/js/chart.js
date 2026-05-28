// 🌌 TradingView Lightweight Candlestick Charts 통합 그래픽 모듈
// 다중 해상도 집계(1M, 5M, 15M, 1H) 및 금융 보조지표(MA7, MA25) 기능을 제공합니다.
// 모든 중요 실행 로직마다 자세한 한글 주석을 장착하였습니다.

import { state } from './state.js';

// 차트 엔진 핵심 인스턴스 전역 변수들
let chart = null;
let candlestickSeries = null;
let volumeSeries = null;
let ma7Series = null;  // 단기 7일 이동평균선 시리즈 (Neon Amber)
let ma25Series = null; // 장기 25일 이동평균선 시리즈 (Neon Pink)
let container = null;

// 실시간 클라이언트 집계를 위한 단일 진행 중인 캔들 상태
let currentCandle = null;
let currentVolume = 0;
let loadedCandlesBuffer = []; // 이동평균선 연속 연산을 위해 로드된 전체 캔들 배열을 버퍼링합니다.

/**
 * 차트 패널 컨테이너 영역에 TradingView Lightweight Charts 인스턴스를 초고속 마운트합니다.
 */
export function initChart() {
    container = document.getElementById('tv-chart-container');
    if (!container) return;

    // 재생성 시 기존 DOM 요소를 깔끔하게 청소하여 메모리 누수를 원천 예방합니다.
    container.innerHTML = '';

    // 1. 고성능 다크 테크 글래스모피즘 차트 옵션 설정
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
                style: 3, // dashed (점선 효과)
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

    // 2. 캔들스틱 메인 시리즈 레이어 추가
    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',      // 상승봉: Neon Green
        downColor: '#ef4444',    // 하락봉: Neon Red
        borderDownColor: '#ef4444',
        borderUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        wickUpColor: '#22c55e',
    });

    // 3. 거래량 히스토그램 시리즈 추가 (차트 하단 20% 영역에 겹치도록 설정)
    volumeSeries = chart.addHistogramSeries({
        color: 'rgba(59, 130, 246, 0.3)', // 투명감 있는 파란색
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '', // Y축 공유하지 않고 단독 레이오버
    });

    volumeSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.8, // 상단 80% 여백을 주어 하단 20% 위치에 핏 고정
            bottom: 0,
        },
    });

    // 4. 이동평균 보조지표(MA7, MA25) 라인 시리즈 추가
    ma7Series = chart.addLineSeries({
        color: '#f59e0b', // MA7: Neon Amber/Orange
        lineWidth: 1.5,
        title: 'MA7',
        priceScaleId: 'right', // 캔들스틱 가격 스케일 공유
    });

    ma25Series = chart.addLineSeries({
        color: '#ec4899', // MA25: Neon Pink
        lineWidth: 1.5,
        title: 'MA25',
        priceScaleId: 'right', // 캔들스틱 가격 스케일 공유
    });

    // 디폴트 마켓 기본값으로 시뮬레이션 데이터를 먼저 예쁘게 씨딩합니다.
    const basePrice = state.currentSymbol === 'BTC-USD' ? 65000 : 500;
    seedHistoricalCandles(basePrice);

    // 모바일 및 화면 리사이즈 시 즉각 대응하는 레이아웃 리스너 등록
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 200);
}

/**
 * 브라우저 뷰포트 크기가 변경될 때 차트 크기를 깨짐 없이 자동으로 맞춰줍니다.
 */
export function resizeCanvas() {
    if (!chart || !container) return;
    const rect = container.getBoundingClientRect();
    chart.resize(rect.width, rect.height || 330);
}

/**
 * 수식: 단순 이동평균(Simple Moving Average - SMA)을 빠르게 연산하여 라인 데이터를 매핑합니다.
 */
function calculateSMA(candles, period) {
    const result = [];
    for (let i = 0; i < candles.length; i++) {
        // 평균 기간을 계산하기에 충분한 데이터가 쌓이지 않았을 경우 그리지 않고 통과시킵니다.
        if (i < period - 1) {
            continue;
        }
        
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += candles[i - j].close;
        }
        result.push({
            time: candles[i].time,
            value: sum / period
        });
    }
    return result;
}

/**
 * 집계 데이터가 없을 때 UX를 위해 100분간의 가상 시세 캔들 흐름을 즉각 그리는 세이프 가드 함수
 */
export function seedHistoricalCandles(basePrice) {
    if (!candlestickSeries || !volumeSeries || !ma7Series || !ma25Series) return;

    const candles = [];
    const volumeData = [];
    let lastPrice = basePrice;
    
    const offsetSeconds = new Date().getTimezoneOffset() * 60;

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

    // 버퍼에 데이터 적재
    loadedCandlesBuffer = [...candles];

    candlestickSeries.setData(candles);
    volumeSeries.setData(volumeData);

    // 이동평균선 데이터 계산 및 설정
    ma7Series.setData(calculateSMA(candles, 7));
    ma25Series.setData(calculateSMA(candles, 25));

    const lastCandle = candles[candles.length - 1];
    currentCandle = { ...lastCandle };
    currentVolume = volumeData[volumeData.length - 1].value;
}

/**
 * 백엔드 REST API(/admin/stats/candles)를 비동기로 호출하여 실제 DB상의 역사 캔들을 차트에 입히고
 * 보조지표(MA7, MA25)를 다이내믹하게 드로잉합니다.
 *
 * @param symbol     코인 심볼 (BTC-USD / ADA-KRW)
 * @param basePrice  로딩 실패 시 씨더 대체용 기본값
 * @param resolution 집계 단위 (1m, 5m, 15m, 1h)
 */
export async function fetchAndLoadHistoricalCandles(symbol, basePrice, resolution = '1m') {
    if (!candlestickSeries || !volumeSeries || !ma7Series || !ma25Series) return;

    const host = window.location.hostname || 'localhost';
    // 다중 시간 해상도 파라미터를 REST 주소에 동적으로 주입합니다.
    const url = `http://${host}:8181/admin/stats/candles?symbol=${symbol}&resolution=${resolution}&limit=120`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');

        const data = await response.json();

        if (data && data.length > 0) {
            const candles = [];
            const volumeData = [];
            const offsetSeconds = new Date().getTimezoneOffset() * 60;

            for (const item of data) {
                const isUp = item.close >= item.open;
                // 브라우저의 현지 타임존 오프셋을 초(seconds) 단위로 차감하여 정렬합니다.
                const adjustedTime = item.time - offsetSeconds;
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
                    color: isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
                });
            }

            // 하이브리드 보정 패딩 엔진 작동 (DB 데이터가 100건보다 적은 경우)
            // 비어 있는 앞부분의 차트 영역을 가상의 연속적인 캔들로 가득 채워, 
            // 사용자에게 언제나 풍부하고 아름다운 차트 경험을 끊김 없이 보장합니다.
            if (candles.length < 100) {
                const padCount = 100 - candles.length;
                let intervalSeconds = 60;
                switch (resolution.toLowerCase()) {
                    case '5m': intervalSeconds = 300; break;
                    case '15m': intervalSeconds = 900; break;
                    case '1h': intervalSeconds = 3600; break;
                    default: intervalSeconds = 60; break;
                }

                const paddedCandles = [];
                const paddedVolume = [];
                
                // 첫 실제 데이터의 시작 가격과 시간 기준으로 역방향 정밀 스무스 연산 수행
                let lastPrice = candles[0].open;
                const oldestTime = candles[0].time;

                for (let i = 1; i <= padCount; i++) {
                    const time = oldestTime - i * intervalSeconds;
                    const close = lastPrice;
                    const drift = (Math.random() - 0.5) * (basePrice * 0.003);
                    const open = close - drift;
                    const high = Math.max(open, close) + Math.random() * (basePrice * 0.001);
                    const low = Math.min(open, close) - Math.random() * (basePrice * 0.001);
                    const volume = Math.floor(Math.random() * 800) + 100;
                    const isUp = close >= open;

                    paddedCandles.push({ time, open, high, low, close });
                    paddedVolume.push({
                        time,
                        value: volume,
                        color: isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
                    });

                    lastPrice = open;
                }

                // 역순으로 생성했으므로 시간 순서에 맞춰 뒤집기(reverse)를 진행합니다.
                paddedCandles.reverse();
                paddedVolume.reverse();

                // 실제 데이터의 앞부분에 결합하여 시간적 흐름을 완벽히 이어붙입니다.
                candles.unshift(...paddedCandles);
                volumeData.unshift(...paddedVolume);
            }

            // 전역 버퍼 업데이트
            loadedCandlesBuffer = [...candles];

            // 캔들 및 거래량 차트 데이터 바인딩
            candlestickSeries.setData(candles);
            volumeSeries.setData(volumeData);

            // 이동평균선(MA7, MA25) 다이내믹 계산 및 매핑
            ma7Series.setData(calculateSMA(candles, 7));
            ma25Series.setData(calculateSMA(candles, 25));

            // 실시간 웹소켓 델타 업데이트 인수인계를 위해 현재 마지막 봉의 상태를 저장
            const lastCandle = candles[candles.length - 1];
            currentCandle = { ...lastCandle };
            currentVolume = volumeData[volumeData.length - 1].value;

            return;
        }
    } catch (e) {
        console.warn('Failed to fetch real historical candles, falling back to simulated seeding:', e);
    }

    // 예외 상황이나 DB가 완전히 빈 경우, fallback으로 가상 시뮬레이션 데이터를 주입
    seedHistoricalCandles(basePrice);
}

/**
 * 실시간 웹소켓 체결 바이너리 스트림이 도착할 때마다 호출되며,
 * 거래 트랜잭션 하나하나를 현재 진행 중인 캔들 및 이동평균선 정보에 실시간으로 집계 및 갱신합니다.
 */
export function addPriceTick(price) {
    if (!candlestickSeries || !volumeSeries || !ma7Series || !ma25Series) return;

    // 현재 선택된 해상도 집계 주기(초 단위)를 state로부터 파악합니다.
    let resolutionSeconds = 60;
    const activeRes = state.activeResolution || '1m';
    switch (activeRes.toLowerCase()) {
        case '5m': resolutionSeconds = 300; break;
        case '15m': resolutionSeconds = 900; break;
        case '1h': resolutionSeconds = 3600; break;
        default: resolutionSeconds = 60; break;
    }

    const offsetSeconds = new Date().getTimezoneOffset() * 60;
    // 현재 시간을 해상도 단위 경계선으로 버킷 분할 정수내림 처리합니다.
    const bucketTime = Math.floor(Date.now() / (resolutionSeconds * 1000)) * resolutionSeconds - offsetSeconds;

    if (!currentCandle || bucketTime > currentCandle.time) {
        // 집계 시간축이 변경되었으므로 신규 봉(Candlestick)을 새롭게 마운트합니다.
        currentCandle = {
            time: bucketTime,
            open: price,
            high: price,
            low: price,
            close: price
        };
        currentVolume = Math.floor(Math.random() * 5) + 1;
        
        // 전역 역사 버퍼에 신규 봉 데이터를 누적합니다.
        loadedCandlesBuffer.push({ ...currentCandle });
        if (loadedCandlesBuffer.length > 200) {
            loadedCandlesBuffer.shift(); // 메모리 최적화를 위해 최대 버퍼 크기 유지
        }
    } else {
        // 기존 진행 중인 봉의 고가/저가/종가/거래량 실시간 증감 연산 처리
        currentCandle.close = price;
        currentCandle.high = Math.max(currentCandle.high, price);
        currentCandle.low = Math.min(currentCandle.low, price);
        currentVolume += 1;
        
        // 전역 버퍼의 가장 최신 봉 정보도 실시간 갱신합니다.
        if (loadedCandlesBuffer.length > 0) {
            loadedCandlesBuffer[loadedCandlesBuffer.length - 1] = { ...currentCandle };
        }
    }

    // 캔들 및 거래량 실시간 렌더링 업데이트
    candlestickSeries.update(currentCandle);
    volumeSeries.update({
        time: bucketTime,
        value: currentVolume,
        color: currentCandle.close >= currentCandle.open ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'
    });

    // 변경된 가격에 의거해 실시간 이동평균선(MA7, MA25) 보조지표 선들을 순식간에 재연산하여 뿌려줍니다.
    if (loadedCandlesBuffer.length >= 7) {
        const sma7 = calculateSMA(loadedCandlesBuffer, 7);
        ma7Series.update(sma7[sma7.length - 1]);
    }
    if (loadedCandlesBuffer.length >= 25) {
        const sma25 = calculateSMA(loadedCandlesBuffer, 25);
        ma25Series.update(sma25[sma25.length - 1]);
    }
}

// 이전 레거시 차트와의 호환성 유지를 위해 비워둠
export function drawPriceChart() {}
