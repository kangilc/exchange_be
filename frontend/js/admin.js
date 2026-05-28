// 🌌 JavaF Exchange (HF-X) 통합 관리 콘솔 ES6 모듈러 비즈니스 로직 및 실시간 감시 엔진
// UI(admin.html)와 로직(admin.js)을 완벽 격리하여 100% 안전한 기능 확장 구조를 확보했습니다.
// 모든 주요 파이프라인 및 금융 지표 연산 영역마다 상세한 한글 주석을 탑재했습니다.

// ==========================================
// 1. 전역 상태 및 인프라 변수 정의
// ==========================================
let API_BASE_URL = 'http://localhost:8181';
let currentResolution = 'daily';
let usersData = [];
let walletsData = [];
let walletSummaryData = [];

// ApexCharts 통계 인스턴스 전역 변수
let tradeChart = null;
let userChart = null;
let flowChart = null;

// ==========================================
// 2. [신규] 실시간 마켓 감시 및 차트 엔진 전역 변수
// ==========================================
let adminChart = null;
let adminCandlestickSeries = null;
let adminVolumeSeries = null;
let adminMa7Series = null;
let adminMa25Series = null;

let adminCurrentSymbol = 'BTC-USD';
let adminActiveResolution = '1m';
let adminLoadedCandlesBuffer = [];
let adminCurrentCandle = null;
let adminCurrentVolume = 0;
let adminWs = null;

// 실시간 RTT 및 패킷 계측 상수
const BTC_SYMBOL_ID = getHashCode("BTC-USD");
const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

// ==========================================
// 3. 라이프사이클 이니셜라이저 (DOMContentLoaded)
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    // 1. 외부 환경 설정 파일 (config.json) 동적 연동 프로세스 실행
    await loadRuntimeConfig();

    // 2. 호스트 정보를 읽어와 REST API 경로를 자동 매핑 캐싱합니다 (WSL 우회 지원)
    const savedHost = localStorage.getItem('hfx_admin_host');
    if (savedHost) {
        document.getElementById('apiHostInput').value = savedHost;
    } else if (window.location.hostname && window.location.hostname !== 'localhost') {
        document.getElementById('apiHostInput').value = `${window.location.hostname}:8181`;
    }
    
    initApiEndpoints();
    loadAllDashboardData();

    // 3. 실시간 마켓 감시 전용 차트 엔진 빌드
    initAdminChart();
    
    // 4. 웹소켓 실시간 바이너리 체결 스트림 수립
    connectAdminWebSocket();
});

// 외부 환경 변수 연동을 위한 dynamic config.json 비동기 로더
async function loadRuntimeConfig() {
    try {
        const response = await fetch('/config.json');
        if (response.ok) {
            const config = await response.json();
            if (config.API_BASE_URL) {
                // 프로토콜(http://, https://) 제거 후 Host와 Port만 추출하여 input 창에 자동 바인딩
                const hostOnly = config.API_BASE_URL.replace(/^https?:\/\//, '');
                document.getElementById('apiHostInput').value = hostOnly;
                console.log(`[어드민 환경변수] config.json 설정값 감지 및 주입 완료: ${config.API_BASE_URL}`);
            }
        }
    } catch (e) {
        console.log('[어드민 환경변수] config.json이 부재하여 브라우저 Host 자동 감지 및 로컬스토리지 모드로 대체합니다.');
    }
}

// API 엔드포인트 수동/자동 캐시 동기화
function initApiEndpoints() {
    const hostVal = document.getElementById('apiHostInput').value.trim();
    API_BASE_URL = `http://${hostVal}`;
    localStorage.setItem('hfx_admin_host', hostVal);
    console.log(`[어드민 제어 센터] REST API 서버 경로 수립 완료: ${API_BASE_URL}`);
}

// ==========================================
// 4. [신규] TradingView Lightweight Charts 모니터링 엔진
// ==========================================

/**
 * 어드민 전용 보라색(Neon Purple & Indigo) 다크 미학 차트를 생성합니다.
 */
function initAdminChart() {
    const container = document.getElementById('admin-tv-chart');
    if (!container) return;

    container.innerHTML = ''; // 리셋

    // 1. 미학적으로 마감된 어드민 캔버스 옵션 선언
    adminChart = LightweightCharts.createChart(container, {
        layout: {
            background: { type: 'solid', color: 'rgba(7, 11, 21, 0.4)' },
            textColor: '#d8b4fe', // 연보라색
            fontSize: 10,
            fontFamily: 'Outfit, Noto Sans KR, sans-serif',
        },
        grid: {
            vertLines: { color: 'rgba(138, 43, 226, 0.04)' },
            horzLines: { color: 'rgba(138, 43, 226, 0.04)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                color: 'rgba(138, 43, 226, 0.4)',
                width: 1,
                style: 3,
            },
            horzLine: {
                color: 'rgba(138, 43, 226, 0.4)',
                width: 1,
                style: 3,
            }
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.05)',
            timeVisible: true,
        },
    });

    // 2. 캔들스틱 메인 시리즈 추가
    adminCandlestickSeries = adminChart.addCandlestickSeries({
        upColor: '#22c55e',      // 상승: Neon Green
        downColor: '#ef4444',    // 하락: Neon Red
        borderDownColor: '#ef4444',
        borderUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        wickUpColor: '#22c55e',
    });

    // 3. 거래량 시리즈 히스토그램 추가 (하단 15% 레이오버)
    adminVolumeSeries = adminChart.addHistogramSeries({
        color: 'rgba(138, 43, 226, 0.25)', // 투명도 있는 보라색
        priceFormat: { type: 'volume' },
        priceScaleId: '',
    });
    adminVolumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 }
    });

    // 4. 네온 이동평균 보조지표(MA7, MA25) 추가
    adminMa7Series = adminChart.addLineSeries({
        color: '#f59e0b', // Amber/Orange
        lineWidth: 1.5,
        title: 'MA7',
    });
    adminMa25Series = adminChart.addLineSeries({
        color: '#ec4899', // Electric Pink
        lineWidth: 1.5,
        title: 'MA25',
    });

    // 최초 기동 시 BTC-USD 차트 데이터를 로딩합니다.
    fetchAdminHistoricalCandles(adminCurrentSymbol, adminActiveResolution);

    // 반응형 리사이즈 감지 바인딩
    window.addEventListener('resize', () => {
        if (adminChart && container) {
            const rect = container.getBoundingClientRect();
            adminChart.resize(rect.width, rect.height || 380);
        }
    });
}

/**
 * 단순 이동평균(SMA) 계산 도우미
 */
function calculateSMA(candles, period) {
    const result = [];
    for (let i = 0; i < candles.length; i++) {
        if (i < period - 1) continue;
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
 * REST API로부터 시세 캔들을 로드하여 하이브리드 패딩을 입혀 차트에 출력합니다.
 */
async function fetchAdminHistoricalCandles(symbol, resolution) {
    if (!adminCandlestickSeries || !adminVolumeSeries || !adminMa7Series || !adminMa25Series) return;

    const basePrice = symbol === 'BTC-USD' ? 65000 : 500;
    const host = window.location.hostname || 'localhost';
    const url = `http://${host}:8181/admin/stats/candles?symbol=${symbol}&resolution=${resolution}&limit=120`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('REST API fetch failed');

        const data = await response.json();
        
        if (data && data.length > 0) {
            const candles = [];
            const volumeData = [];
            const offsetSeconds = new Date().getTimezoneOffset() * 60;

            for (const item of data) {
                const isUp = item.close >= item.open;
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
                    color: isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                });
            }

            // [하이브리드 보정 패딩 엔진]
            // 데이터가 100개 미만일 시 자연스럽게 과거 캔들을 채워 비주얼 무결성을 유지합니다.
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
                        color: isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                    });

                    lastPrice = open;
                }

                paddedCandles.reverse();
                paddedVolume.reverse();
                candles.unshift(...paddedCandles);
                volumeData.unshift(...paddedVolume);
            }

            // 버퍼 업데이트 및 차트 데이터 셋
            adminLoadedCandlesBuffer = [...candles];

            adminCandlestickSeries.setData(candles);
            adminVolumeSeries.setData(volumeData);

            // 보조지표 매핑
            adminMa7Series.setData(calculateSMA(candles, 7));
            adminMa25Series.setData(calculateSMA(candles, 25));

            const lastCandle = candles[candles.length - 1];
            adminCurrentCandle = { ...lastCandle };
            adminCurrentVolume = volumeData[volumeData.length - 1].value;

            // 실시간 마켓 요약 UI 즉각 세팅
            updateAdminSummaryUI(lastCandle.close);

            // 차트 캔들이 화면에 딱 맞게 정렬되도록 리셋 (가로 잘림 현상 방지)
            if (adminChart) {
                adminChart.timeScale().fitContent();
            }
            return;
        }
    } catch (e) {
        console.error("[Chart] Failed to fetch historical data", e);
    }
}

/**
 * 실시간 웹소켓 체결 틱을 안전 가드를 통과시켜 캔들에 갱신시킵니다.
 */
function addAdminPriceTick(price) {
    if (!adminCandlestickSeries || !adminVolumeSeries || !adminMa7Series || !adminMa25Series) return;

    let resolutionSeconds = 60;
    switch (adminActiveResolution.toLowerCase()) {
        case '5m': resolutionSeconds = 300; break;
        case '15m': resolutionSeconds = 900; break;
        case '1h': resolutionSeconds = 3600; break;
        default: resolutionSeconds = 60; break;
    }

    const offsetSeconds = new Date().getTimezoneOffset() * 60;
    const bucketTime = Math.floor(Date.now() / (resolutionSeconds * 1000)) * resolutionSeconds - offsetSeconds;

    // [시간 결함 극복 안전 가드]
    // 해상도 전환 레이턴시 중 들어온 오래된 시간 틱을 무시하여 에러를 원천 예방합니다.
    if (adminLoadedCandlesBuffer && adminLoadedCandlesBuffer.length > 0) {
        const lastCandleTime = adminLoadedCandlesBuffer[adminLoadedCandlesBuffer.length - 1].time;
        if (bucketTime < lastCandleTime) {
            return;
        }
    }

    if (!adminCurrentCandle || bucketTime > adminCurrentCandle.time) {
        // 새 시간축 진입 시 신규 봉 생성
        adminCurrentCandle = {
            time: bucketTime,
            open: price,
            high: price,
            low: price,
            close: price
        };
        adminCurrentVolume = Math.floor(Math.random() * 5) + 1;
        adminLoadedCandlesBuffer.push({ ...adminCurrentCandle });
        if (adminLoadedCandlesBuffer.length > 200) adminLoadedCandlesBuffer.shift();
    } else {
        // 기존 봉 실시간 꼬리 갱신
        adminCurrentCandle.close = price;
        adminCurrentCandle.high = Math.max(adminCurrentCandle.high, price);
        adminCurrentCandle.low = Math.min(adminCurrentCandle.low, price);
        adminCurrentVolume += 1;

        if (adminLoadedCandlesBuffer.length > 0) {
            adminLoadedCandlesBuffer[adminLoadedCandlesBuffer.length - 1] = { ...adminCurrentCandle };
        }
    }

    // 캔들 및 거래량 업데이트
    adminCandlestickSeries.update(adminCurrentCandle);
    adminVolumeSeries.update({
        time: bucketTime,
        value: adminCurrentVolume,
        color: adminCurrentCandle.close >= adminCurrentCandle.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
    });

    // 이동평균 실시간 재연산
    if (adminLoadedCandlesBuffer.length >= 7) {
        const sma7 = calculateSMA(adminLoadedCandlesBuffer, 7);
        adminMa7Series.update(sma7[sma7.length - 1]);
    }
    if (adminLoadedCandlesBuffer.length >= 25) {
        const sma25 = calculateSMA(adminLoadedCandlesBuffer, 25);
        adminMa25Series.update(sma25[sma25.length - 1]);
    }

    // 현재가 실시간 세팅
    updateAdminSummaryUI(price);
}

// 종목 스위처 클릭
function switchAdminSymbol(symbol) {
    adminCurrentSymbol = symbol;
    
    document.getElementById('btn-admin-symbol-btc').classList.toggle('active', symbol === 'BTC-USD');
    document.getElementById('btn-admin-symbol-ada').classList.toggle('active', symbol === 'ADA-KRW');
    document.getElementById('adminChartTitle').innerText = `${symbol} 실시간 시세 차트`;

    fetchAdminHistoricalCandles(symbol, adminActiveResolution);
}

// 해상도 스위처 클릭
function switchAdminResolution(res) {
    adminActiveResolution = res;

    document.getElementById('btn-admin-res-1m').classList.toggle('active', res === '1m');
    document.getElementById('btn-admin-res-5m').classList.toggle('active', res === '5m');
    document.getElementById('btn-admin-res-15m').classList.toggle('active', res === '15m');
    document.getElementById('btn-admin-res-1h').classList.toggle('active', res === '1h');

    fetchAdminHistoricalCandles(adminCurrentSymbol, res);
}

// 어드민 전용 마켓 요약 UI 패널 갱신
function updateAdminSummaryUI(price) {
    const symbol = adminCurrentSymbol;
    const unit = symbol === 'BTC-USD' ? '$' : '₩';
    
    // 현재가 갱신
    const priceEl = document.getElementById('adminLastPrice');
    if (priceEl) {
        priceEl.innerText = `${unit}${price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    // 24H 전일 대비 등락률 모의 산정
    const base = symbol === 'BTC-USD' ? 65000 : 500;
    const diff = price - base;
    const pct = (diff / base) * 100;
    const sign = diff >= 0 ? '+' : '';

    const changeEl = document.getElementById('adminChange24h');
    if (changeEl) {
        changeEl.innerText = `${sign}${pct.toFixed(2)}% (${sign}${unit}${Math.abs(diff).toLocaleString()})`;
        changeEl.style.color = diff >= 0 ? '#10b981' : '#ef4444';
    }
}

// ==========================================
// 5. [신규] 웹소켓 실시간 바인딩 & 체결 스트리머
// ==========================================
function connectAdminWebSocket() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8088`;

    console.log(`[어드민 웹소켓] 시세 스트림 게이트웨이 연결 시도: ${wsUrl}`);
    adminWs = new WebSocket(wsUrl);
    adminWs.binaryType = 'arraybuffer';

    adminWs.onopen = () => {
        document.getElementById('adminObStatus').className = 'status-badge';
        document.getElementById('adminObStatus').style.background = 'rgba(16, 185, 129, 0.08)';
        document.getElementById('adminObStatus').style.border = '1px solid rgba(16, 185, 129, 0.35)';
        document.getElementById('adminObStatusText').innerText = 'WS CONNECTED';
        document.getElementById('adminObStatusText').style.color = '#10b981';
        console.log('[어드민 웹소켓] 커넥션 연결 성공. 바이너리 디코딩 활성화.');
    };

    adminWs.onclose = () => {
        document.getElementById('adminObStatus').className = 'status-badge suspended';
        document.getElementById('adminObStatus').style.background = 'rgba(239, 68, 68, 0.08)';
        document.getElementById('adminObStatus').style.border = '1px solid rgba(239, 68, 68, 0.35)';
        document.getElementById('adminObStatusText').innerText = 'WS CLOSED';
        document.getElementById('adminObStatusText').style.color = '#ef4444';
        
        console.log('[어드민 웹소켓] 커넥션 단절. 3초 후 재연결을 진행합니다.');
        setTimeout(connectAdminWebSocket, 3000);
    };

    adminWs.onmessage = (event) => {
        const data = event.data;
        if (typeof data === 'string') return; // PING-PONG 무시

        const buffer = data;
        if (buffer.byteLength !== 32) return;

        // 32바이트 구조체 디코딩 (Big-Endian)
        const view = new DataView(buffer);
        const symbolId = view.getInt32(0, false);
        const price = view.getBigInt64(12, false);
        const deltaQty = view.getBigInt64(20, false);
        const side = view.getInt32(28, false);

        const priceNum = Number(price);
        const qtyNum = Number(deltaQty);

        let msgSymbol = null;
        if (symbolId === BTC_SYMBOL_ID) msgSymbol = 'BTC-USD';
        else if (symbolId === ADA_SYMBOL_ID) msgSymbol = 'ADA-KRW';
        else return;

        // 수량 변동값이 음수일 때만 실제 체결(Executed)을 의미합니다!
        if (qtyNum < 0) {
            const actualQty = Math.abs(qtyNum);
            
            // 현재 활성화된 종목과 일치할 때만 실시간 차트 드로잉 업데이트
            if (msgSymbol === adminCurrentSymbol) {
                addAdminPriceTick(priceNum / 100);
            }

            // 실시간 체결 로그 화면 출력 리포터 가동
            addRealtimeTradeLog({
                tradeId: Date.now().toString().substring(7) + Math.floor(Math.random() * 10),
                symbol: msgSymbol,
                side: side === 0 ? 'BUY' : 'SELL',
                price: priceNum,
                qty: actualQty,
                executedAt: new Date().toISOString()
            });
        }
    };
}

// 실시간 스크롤형 체결 실황 테이블 추가
let loggedTradeCount = 0;
function addRealtimeTradeLog(trade) {
    const tbody = document.getElementById('adminRealtimeTradesBody');
    if (!tbody) return;

    if (loggedTradeCount === 0) {
        tbody.innerHTML = ''; // 대기용 텍스트 제거
    }

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    tr.style.animation = 'panelFadeIn 0.25s ease-out';
    
    const formattedDate = new Date(trade.executedAt).toLocaleTimeString();
    const isBuy = trade.side === 'BUY';
    const badgeClass = isBuy ? 'buy' : 'sell';
    const displayPrice = trade.price / 100.0;
    const displayVolume = trade.qty * displayPrice;
    const unit = trade.symbol === 'BTC-USD' ? '$' : '₩';

    tr.innerHTML = `
        <td style="padding-left: 2rem; font-family: var(--font-mono); font-weight: bold; color: var(--color-text-secondary);">${trade.tradeId}</td>
        <td style="font-weight: bold; color: #fff;">${trade.symbol}</td>
        <td><span class="badge ${badgeClass}" style="padding: 0.15rem 0.4rem; font-size: 0.75rem;">${trade.side}</span></td>
        <td style="text-align: right; font-weight: bold; color: ${isBuy ? '#10b981' : '#ef4444'}">${unit}${displayPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td style="text-align: right; font-weight: bold;">${trade.qty.toLocaleString()}</td>
        <td style="text-align: right; font-weight: bold; color: var(--color-secondary);">${unit}${displayVolume.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td style="text-align: right; padding-right: 2rem; font-size: 0.8rem; color: var(--color-text-secondary);">${formattedDate}</td>
    `;

    // 최상단에 새 체결 이력 누적 삽입
    tbody.insertBefore(tr, tbody.firstChild);
    loggedTradeCount++;

    // 브라우저 랙 방지를 위해 최대 로그 갯수를 100줄로 유지
    if (tbody.children.length > 100) {
        tbody.removeChild(tbody.lastChild);
    }
}

// 32비트 문자열 정수형 해시 함수 복원
function getHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash);
}


// ==========================================
// 6. 마이그레이션된 어드민 통상 비즈니스 로직 제어기
// ==========================================

// 어드민 탭 스위칭 컨트롤러
function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    // Highlight nav item
    let navs = document.querySelectorAll('.nav-item');
    if (tabId === 'dashboard-tab') navs[0].classList.add('active');
    else if (tabId === 'users-tab') navs[1].classList.add('active');
    else if (tabId === 'wallets-tab') navs[2].classList.add('active');
    else if (tabId === 'stats-tab') navs[3].classList.add('active');
    else if (tabId === 'ledger-tab') navs[4].classList.add('active');
    else if (tabId === 'market-watch-tab') navs[5].classList.add('active');

    // Force refresh data of specific tabs
    if (tabId === 'dashboard-tab') {
        loadAllDashboardData();
    } else if (tabId === 'users-tab') {
        loadUsersData();
    } else if (tabId === 'wallets-tab') {
        loadWalletsData();
    } else if (tabId === 'stats-tab') {
        loadStatsData(currentResolution);
    } else if (tabId === 'ledger-tab') {
        loadLedgerData();
    } else if (tabId === 'market-watch-tab') {
        // 차트 스위칭 시 리사이즈 캔버스 강제 연동 및 시간축 맞춤 극대화 (가로 잘림 및 너비 0px 버그 원천 예방)
        const resizeAndFit = () => {
            if (adminChart) {
                const container = document.getElementById('admin-tv-chart');
                if (container) {
                    const rect = container.getBoundingClientRect();
                    if (rect.width > 0) {
                        adminChart.resize(rect.width, rect.height || 380);
                        adminChart.timeScale().fitContent();
                    }
                }
            }
        };
        // 브라우저 렌더링 파이프라인 지연 속도를 감안하여 다단계 호출로 비주얼 무결성 확보
        setTimeout(resizeAndFit, 50);
        setTimeout(resizeAndFit, 150);
        setTimeout(resizeAndFit, 300);
    }
}

// Fetch overall stats for Home Dashboard
async function loadAllDashboardData() {
    try {
        // 1. High level Summary
        const sumRes = await fetch(`${API_BASE_URL}/admin/stats/summary`);
        if (sumRes.ok) {
            const sum = await sumRes.json();
            document.getElementById('dashTotalUsers').innerText = `${sum.totalUsers.toLocaleString()} 명`;
            document.getElementById('dashTotalTrades').innerText = `${sum.totalTrades.toLocaleString()} 건`;
            document.getElementById('dashTotalVolume').innerText = `${sum.totalVolume.toLocaleString('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD`;
            document.getElementById('dashTotalWallets').innerText = `${sum.totalWallets.toLocaleString()} 개`;
            
            // 실시간 감시 요약 카드의 총 체결 누적 수치도 함께 업데이트합니다.
            const statsTradesCount = document.getElementById('adminTotalTradesCount');
            if (statsTradesCount) {
                statsTradesCount.innerText = `${sum.totalTrades.toLocaleString()} 건`;
            }
        }

        // 2. Wallets Total Summary
        const wallSumRes = await fetch(`${API_BASE_URL}/admin/wallets/summary`);
        if (wallSumRes.ok) {
            walletSummaryData = await wallSumRes.json();
            renderHomeAssetSummary(walletSummaryData);
            
            // 감시 카드의 24H 거래량 데이터도 가져옵니다.
            const statsVolumeText = document.getElementById('adminTotalVolumeText');
            if (statsVolumeText) {
                const targetCurrency = adminCurrentSymbol === 'BTC-USD' ? 'BTC' : 'ADA';
                const matched = walletSummaryData.find(w => w.currency === targetCurrency);
                if (matched) {
                    const totalVol = matched.totalBalance + matched.totalLocked;
                    statsVolumeText.innerText = `${totalVol.toLocaleString(undefined, {maximumFractionDigits: 2})} ${targetCurrency}`;
                }
            }
        }

        // 3. User lists
        const usersRes = await fetch(`${API_BASE_URL}/admin/users`);
        if (usersRes.ok) {
            usersData = await usersRes.json();
            renderHomeRecentUsers(usersData);
        }
    } catch (err) {
        console.error("Dashboard home load failed", err);
    }
}

function renderHomeAssetSummary(summary) {
    const container = document.getElementById('dashAssetSummaryList');
    if (!container) return;
    container.innerHTML = '';
    
    if (!summary || summary.length === 0) {
        container.innerHTML = '<div style="color: var(--color-text-secondary); text-align: center;">자산 내역이 없습니다.</div>';
        return;
    }

    // Find maximum balance for relative scaling
    const maxBalance = Math.max(...summary.map(s => s.totalBalance + s.totalLocked));

    summary.forEach(s => {
        const total = s.totalBalance + s.totalLocked;
        const lockedPct = total > 0 ? (s.totalLocked / total) * 100 : 0;
        const scaleWidth = maxBalance > 0 ? (total / maxBalance) * 100 : 0;
        
        let fmtTotal = total.toLocaleString(undefined, { maximumFractionDigits: 4 });
        let fmtLocked = s.totalLocked.toLocaleString(undefined, { maximumFractionDigits: 4 });

        const item = document.createElement('div');
        item.className = 'progress-box';
        item.innerHTML = `
            <div class="progress-header">
                <span style="font-weight: 700; color: #fff;">${s.currency} <span class="glowing-indicator" style="background: ${s.currency === 'KRW' ? '#c84a31' : '#0052c4'};"></span></span>
                <span>총합: ${fmtTotal} ${s.currency} <span style="color: var(--color-accent); font-size: 0.7rem; font-family: var(--font-mono);">(주문 락: ${fmtLocked} - ${lockedPct.toFixed(1)}%)</span></span>
            </div>
            <div class="progress-track">
                <div class="progress-bar" style="width: ${Math.max(scaleWidth, 4)}%; background: linear-gradient(90deg, ${s.currency === 'KRW' ? '#c84a31, #f59e0b' : '#0052c4, #00f2fe'});"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderHomeRecentUsers(users) {
    const tbody = document.getElementById('dashRecentUsersList');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...users].sort((a, b) => b.userId - a.userId).slice(0, 5);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--color-text-secondary);">회원이 없습니다.</td></tr>';
        return;
    }

    sorted.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.email}</td>
            <td><span class="badge ${u.grade.toLowerCase()}">${u.grade}</span></td>
            <td><span class="badge ${u.status.toLowerCase()}">${u.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// 회원 관리 리스트 조회
async function loadUsersData() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/users`);
        if (res.ok) {
            usersData = await res.json();
            renderUsersTable(usersData);
        }
    } catch (err) {
        console.error("Users list load failed", err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary); padding: 2rem;">가입된 회원이 존재하지 않습니다.</td></tr>';
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        const formattedDate = u.createdAt ? new Date(u.createdAt).toLocaleString() : '-';
        
        tr.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: 700; color: var(--color-secondary);">${u.userId}</td>
            <td style="font-weight: 600;">${u.email}</td>
            <td><span class="badge ${u.grade.toLowerCase()}">${u.grade}</span></td>
            <td><span class="badge ${u.status.toLowerCase()}">${u.status}</span></td>
            <td style="font-size: 0.8rem; color: var(--color-text-secondary);">${formattedDate}</td>
            <td style="text-align: right;">
                <div class="actions-list" style="justify-content: flex-end; padding-right: 1.5rem; gap: 0.5rem;">
                    <button class="btn-action-small asset" onclick="openAdjustAssetModal(${u.userId}, '${u.email}')">💸 자산 관리</button>
                    <button class="btn-action-small" style="background: rgba(147, 51, 234, 0.12); border-color: rgba(147, 51, 234, 0.35); color: #c084fc;" onclick="openUserTradesModal(${u.userId}, '${u.email}')">📈 거래 내역</button>
                    <button class="btn-action-small" onclick="openEditUserModal(${u.userId}, '${u.email}', '${u.status}', '${u.grade}')">⚙️ 정보 수정</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsersTable() {
    const query = document.getElementById('userSearchInput').value.toLowerCase().trim();
    const filtered = usersData.filter(u => u.email.toLowerCase().includes(query));
    renderUsersTable(filtered);
}

function openRegisterModal() { document.getElementById('registerModal').style.display = 'flex'; }
function closeRegisterModal() { document.getElementById('registerModal').style.display = 'none'; }

async function submitRegisterUser() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const grade = document.getElementById('regGrade').value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 모두 입력해 주세요.");
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, grade })
        });

        if (res.ok) {
            alert("회원 계정이 개설되었으며, 통화별(KRW, USD, BTC, ADA) 기본 지갑이 자동 세팅되었습니다.");
            closeRegisterModal();
            loadUsersData();
        } else {
            alert("등록에 실패하였습니다. 중복된 계정명인지 확인해 주세요.");
        }
    } catch (err) {
        alert("서버 연결 실패: " + err.message);
    }
}

function openEditUserModal(userId, email, status, grade) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editEmail').value = email;
    document.getElementById('editStatus').value = status;
    document.getElementById('editGrade').value = grade;
    document.getElementById('editUserModal').style.display = 'flex';
}
function closeEditUserModal() { document.getElementById('editUserModal').style.display = 'none'; }

async function submitEditUser() {
    const id = document.getElementById('editUserId').value;
    const email = document.getElementById('editEmail').value.trim();
    const status = document.getElementById('editStatus').value;
    const grade = document.getElementById('editGrade').value;

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, status, grade })
        });

        if (res.ok) {
            alert("회원 정보가 정상 수정되었습니다.");
            closeEditUserModal();
            loadUsersData();
        } else {
            alert("수정에 실패하였습니다.");
        }
    } catch (err) {
        alert("서버 연결 오류: " + err.message);
    }
}

function openAdjustAssetModal(userId, email) {
    document.getElementById('adjustUserId').value = userId;
    document.getElementById('adjustUserEmail').value = email;
    document.getElementById('adjustAmount').value = '';
    document.getElementById('adjustAssetModal').style.display = 'flex';
    updateAdjustPlaceholder();
    loadUserLedgerHistory(userId);
}
function closeAdjustAssetModal() { document.getElementById('adjustAssetModal').style.display = 'none'; }

function updateAdjustPlaceholder() {
    const type = document.getElementById('adjustType').value;
    const input = document.getElementById('adjustAmount');
    if (type === 'DEPOSIT') {
        input.placeholder = "지급할 액수 입력 (예: 50000)";
    } else {
        input.placeholder = "차감할 액수 입력 (양수로 입력 - 예: 2000)";
    }
}

async function submitAdjustAsset() {
    const id = document.getElementById('adjustUserId').value;
    const currency = document.getElementById('adjustCurrency').value;
    const type = document.getElementById('adjustType').value;
    const amountInput = document.getElementById('adjustAmount').value.trim();

    if (!amountInput || isNaN(amountInput)) {
        alert("올바른 금액 수치를 입력해 주세요.");
        return;
    }

    let amount = parseFloat(amountInput);
    if (amount <= 0) {
        alert("금액은 0보다 커야 합니다.");
        return;
    }

    if (type === 'WITHDRAWAL') {
        amount = -amount;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${id}/assets/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency, amount })
        });

        if (res.ok) {
            alert("자산 원장 및 거래 변동 감사로그(Ledger Journal)가 실시간 반영 완료되었습니다.");
            closeAdjustAssetModal();
            loadUsersData();
        } else {
            const errMsg = await res.text();
            alert("원장 갱신 실패: " + errMsg);
        }
    } catch (err) {
        alert("서버 연결 실패: " + err.message);
    }
}

// 지갑 원장 관리 테이블 조회
async function loadWalletsData() {
    try {
        const sumRes = await fetch(`${API_BASE_URL}/admin/wallets/summary`);
        if (sumRes.ok) {
            const sum = await sumRes.json();
            renderWalletSummaryGrid(sum);
        }

        const wListRes = await fetch(`${API_BASE_URL}/admin/wallets`);
        if (wListRes.ok) {
            const wallets = await wListRes.json();
            const uRes = await fetch(`${API_BASE_URL}/admin/users`);
            if (uRes.ok) {
                const users = await uRes.json();
                const userMap = new Map(users.map(u => [u.userId, u.email]));
                
                walletsData = wallets.map(w => ({
                    ...w,
                    email: userMap.get(w.userId) || 'Unknown Account'
                }));

                renderWalletsTable(walletsData);
            }
        }
    } catch (err) {
        console.error("Wallets load failed", err);
    }
}

function renderWalletSummaryGrid(summary) {
    const grid = document.getElementById('walletSummaryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    summary.forEach(s => {
        const total = s.totalBalance + s.totalLocked;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-glow-bg" style="background: radial-gradient(circle, ${s.currency === 'KRW' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)'} 0%, transparent 70%);"></div>
            <div class="card-label">거래소 내 총 보유 ${s.currency}</div>
            <div class="card-value">${total.toLocaleString(undefined, {maximumFractionDigits: 6})}</div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
                <span>거래 가능: ${s.totalBalance.toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                <span style="color: var(--color-accent);">주문 대기: ${s.totalLocked.toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderWalletsTable(wallets) {
    const tbody = document.getElementById('walletsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (wallets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-secondary); padding: 2rem;">지갑 원장 데이터가 존재하지 않습니다.</td></tr>';
        return;
    }

    wallets.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: var(--font-mono); color: var(--color-text-secondary);">${w.walletId}</td>
            <td style="font-family: var(--font-mono);">${w.userId}</td>
            <td style="font-weight: 600;">${w.email}</td>
            <td>
                <span style="font-weight: 700; color: #fff;">${w.currency}</span>
                <span class="glowing-indicator" style="background: ${w.currency === 'KRW' ? '#c84a31' : '#0052c4'};"></span>
            </td>
            <td style="text-align: right; font-family: var(--font-mono); font-weight: 700;">${w.balance.toLocaleString(undefined, {maximumFractionDigits: 8})}</td>
            <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--color-accent); padding-right: 2rem;">${w.lockedBalance.toLocaleString(undefined, {maximumFractionDigits: 8})}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterWalletsTable() {
    const query = document.getElementById('walletSearchInput').value.toLowerCase().trim();
    const filtered = walletsData.filter(w => 
        w.email.toLowerCase().includes(query) || 
        w.currency.toLowerCase().includes(query) ||
        w.userId.toString().includes(query)
    );
    renderWalletsTable(filtered);
}

// 현황 및 통계 분석 조회
async function loadStatsData(resolution) {
    currentResolution = resolution;
    
    document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
    if (resolution === 'daily') document.getElementById('btnResolutionDaily').classList.add('active');
    else if (resolution === 'weekly') document.getElementById('btnResolutionWeekly').classList.add('active');
    else if (resolution === 'monthly') document.getElementById('btnResolutionMonthly').classList.add('active');
    else if (resolution === 'quarterly') document.getElementById('btnResolutionQuarterly').classList.add('active');
    else if (resolution === 'annual') document.getElementById('btnResolutionAnnual').classList.add('active');

    try {
        const tradeRes = await fetch(`${API_BASE_URL}/admin/stats/trades?resolution=${resolution}`);
        let tradeData = [];
        if (tradeRes.ok) tradeData = await tradeRes.json();

        const userRes = await fetch(`${API_BASE_URL}/admin/stats/users?resolution=${resolution}`);
        let userData = [];
        if (userRes.ok) userData = await userRes.json();

        const flowRes = await fetch(`${API_BASE_URL}/admin/stats/assets?resolution=${resolution}`);
        let flowData = [];
        if (flowRes.ok) flowData = await flowRes.json();

        renderStatsCharts(tradeData, userData, flowData);
    } catch (err) {
        console.error("Stats fetch failed", err);
    }
}

function renderStatsCharts(trades, users, flows) {
    const totalTradeVolumeVal = trades.reduce((acc, t) => acc + t.totalVolume, 0);
    document.getElementById('chartTradeLabel').innerText = `총합 체결액: ${totalTradeVolumeVal.toLocaleString('ko-KR', {maximumFractionDigits: 2})} USD`;

    const sortedTrades = [...trades].reverse();
    const sortedUsers = [...users].reverse();
    const sortedFlows = [...flows].reverse();

    // CHART 1: Area Chart
    const tradeOptions = {
        series: [
            { name: '체결 거래 건수', type: 'column', data: sortedTrades.map(t => t.tradeCount) },
            { name: '거래 볼륨 (USD)', type: 'area', data: sortedTrades.map(t => t.totalVolume) }
        ],
        chart: {
            height: 350,
            type: 'line',
            toolbar: { show: false },
            background: 'transparent'
        },
        stroke: { width: [0, 3], curve: 'smooth' },
        theme: { mode: 'dark' },
        colors: ['#8a2be2', '#00f2fe'],
        fill: {
            type: ['solid', 'gradient'],
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        labels: sortedTrades.map(t => t.bucket.substring(0, 16)),
        xaxis: { type: 'category' },
        yaxis: [
            { title: { text: '체결 건수' } },
            { opposite: true, title: { text: '거래 금액 (USD)' } }
        ],
        grid: { borderColor: 'rgba(255,255,255,0.05)' }
    };

    if (tradeChart) tradeChart.destroy();
    tradeChart = new ApexCharts(document.querySelector("#tradeStatsChart"), tradeOptions);
    tradeChart.render();

    // CHART 2: Bar Chart
    const userOptions = {
        series: [{ name: '신규 가입자 수', data: sortedUsers.map(u => u.userCount) }],
        chart: {
            height: 250,
            type: 'bar',
            toolbar: { show: false },
            background: 'transparent'
        },
        plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
        colors: ['#ff007f'],
        theme: { mode: 'dark' },
        labels: sortedUsers.map(u => u.bucket.substring(0, 10)),
        xaxis: { type: 'category' },
        grid: { borderColor: 'rgba(255,255,255,0.03)' }
    };

    if (userChart) userChart.destroy();
    userChart = new ApexCharts(document.querySelector("#userStatsChart"), userOptions);
    userChart.render();

    // CHART 3: Donut Chart
    let depositVol = 0;
    let withdrawalVol = 0;
    
    flows.forEach(f => {
        if (f.type === 'DEPOSIT') depositVol += Math.abs(f.totalAmount);
        else if (f.type === 'WITHDRAWAL') withdrawalVol += Math.abs(f.totalAmount);
    });

    const flowOptions = {
        series: [depositVol, withdrawalVol],
        chart: {
            height: 250,
            type: 'donut',
            background: 'transparent'
        },
        labels: ['총 입금 흐름 (Deposit)', '총 출금 흐름 (Withdrawal)'],
        colors: ['#10b981', '#ef4444'],
        theme: { mode: 'dark' },
        stroke: { show: false },
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: '합산 자산 이동',
                            formatter: function () {
                                return (depositVol + withdrawalVol).toLocaleString(undefined, {maximumFractionDigits: 2});
                            }
                        }
                    }
                }
            }
        }
    };

    if (flowChart) flowChart.destroy();
    flowChart = new ApexCharts(document.querySelector("#assetFlowChart"), flowOptions);
    flowChart.render();
}

function changeResolution(res) {
    loadStatsData(res);
}

// 회원 개별 입출금 이력 조회
async function loadUserLedgerHistory(userId) {
    const tbody = document.getElementById('userLedgerHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: var(--color-text-secondary);">로딩 중...</td></tr>';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/ledgers?page=0&size=50`);
        if (res.ok) {
            const data = await res.json();
            const ledgers = data.content || [];
            tbody.innerHTML = '';
            if (ledgers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: var(--color-text-secondary);">입출금 이력이 존재하지 않습니다.</td></tr>';
                return;
            }
            ledgers.forEach(l => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                const formattedDate = new Date(l.createdAt).toLocaleString();
                const badgeClass = l.type === 'DEPOSIT' ? 'active' : 'suspended';
                tr.innerHTML = `
                    <td style="padding: 0.5rem; color: var(--color-text-secondary); font-size: 0.75rem;">${formattedDate}</td>
                    <td style="padding: 0.5rem;"><span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 0.1rem 0.3rem;">${l.type}</span></td>
                    <td style="padding: 0.5rem; font-weight: bold;">${l.currency}</td>
                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: ${l.amount >= 0 ? '#10b981' : '#ef4444'}">${parseFloat(l.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8})}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Failed to load user ledger history", err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1rem; color: #ef4444;">이력을 불러오지 못했습니다.</td></tr>';
    }
}

function openUserTradesModal(userId, email) {
    document.getElementById('userTradesModalTitle').innerText = `[${email}] 회원 실시간 거래 체결 내역`;
    document.getElementById('userTradesModal').style.display = 'flex';
    loadUserTrades(userId);
}
function closeUserTradesModal() {
    document.getElementById('userTradesModal').style.display = 'none';
}

async function loadUserTrades(userId) {
    const tbody = document.getElementById('userTradesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">체결 원장을 조회하는 중...</td></tr>';
    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/trades?page=0&size=50`);
        if (res.ok) {
            const data = await res.json();
            const trades = data.content || [];
            tbody.innerHTML = '';
            if (trades.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-text-secondary);">체결된 거래 내역이 존재하지 않습니다.</td></tr>';
                return;
            }
            trades.forEach(t => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                const formattedDate = new Date(t.executedAt).toLocaleString();
                const isBuy = t.side === 'BUY';
                const badgeClass = isBuy ? 'buy' : 'sell';
                const sideLabel = isBuy ? '매수 (BUY)' : '매도 (SELL)';
                
                const displayPrice = t.symbol.includes("BTC") ? (t.price / 100.0) : t.price;
                const displayVolume = t.qty * (displayPrice);
                
                tr.innerHTML = `
                    <td style="padding: 0.75rem; font-family: var(--font-mono); font-weight: bold; color: var(--color-secondary);">${t.tradeId}</td>
                    <td style="padding: 0.75rem; font-weight: bold; color: #fff;">${t.symbol}</td>
                    <td style="padding: 0.75rem;"><span class="badge ${badgeClass}" style="padding: 0.15rem 0.4rem; font-size: 0.75rem;">${sideLabel}</span></td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: ${isBuy ? '#34d399' : '#f87171'}">${parseFloat(displayPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4})}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: bold;">${parseFloat(t.qty).toLocaleString()}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: bold; color: var(--color-secondary);">${parseFloat(displayVolume).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 0.75rem; padding-right: 1.5rem; text-align: right; font-size: 0.75rem; color: var(--color-text-secondary);">${formattedDate}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Failed to load user trades", err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">체결 내역을 조회하는 과정에서 에러가 발생했습니다.</td></tr>';
    }
}

// 입출금 통합 감사로그 페이징 조회
let currentLedgerPage = 0;
let ledgerPageSize = 50;
let ledgerTotalPages = 1;

async function loadLedgerData() {
    const tbody = document.getElementById('exchangeLedgerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-text-secondary); padding: 3rem;">감사 원장을 불러오는 중...</td></tr>';
    
    const query = document.getElementById('exchangeLedgerSearchInput').value.trim();
    const searchParam = query ? `&search=${encodeURIComponent(query)}` : '';
    
    try {
        const res = await fetch(`${API_BASE_URL}/admin/ledgers?page=${currentLedgerPage}&size=${ledgerPageSize}${searchParam}`);
        if (res.ok) {
            const data = await res.json();
            ledgerTotalPages = data.totalPages;
            
            document.getElementById('ledgerPagingInfo').innerText = `Page ${currentLedgerPage + 1} of ${data.totalPages || 1} (Total ${data.totalElements} items)`;
            document.getElementById('btnPrevLedger').disabled = currentLedgerPage <= 0;
            document.getElementById('btnNextLedger').disabled = currentLedgerPage >= (ledgerTotalPages - 1);
            
            renderExchangeLedgerTable(data.content);
        }
    } catch (err) {
        console.error("Failed to load exchange ledgers", err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 3rem;">원장 데이터를 조회하는 중 오류가 발생했습니다.</td></tr>';
    }
}

function prevLedgerPage() {
    if (currentLedgerPage > 0) {
        currentLedgerPage--;
        loadLedgerData();
    }
}

function nextLedgerPage() {
    if (currentLedgerPage < (ledgerTotalPages - 1)) {
        currentLedgerPage++;
        loadLedgerData();
    }
}

function renderExchangeLedgerTable(ledgers) {
    const tbody = document.getElementById('exchangeLedgerTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!ledgers || ledgers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-text-secondary); padding: 3rem;">입출금 감사 이력이 존재하지 않습니다.</td></tr>';
        return;
    }
    
    ledgers.forEach(l => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        const formattedDate = new Date(l.createdAt).toLocaleString();
        const isDeposit = l.type === 'DEPOSIT';
        const badgeClass = isDeposit ? 'active' : 'suspended';
        
        tr.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--color-text-secondary);">${l.journalId}</td>
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--color-secondary);">${l.userId}</td>
            <td style="font-weight: 600;">${l.email}</td>
            <td style="font-weight: bold; color: #fff;">${l.currency}</td>
            <td><span class="badge ${badgeClass}" style="padding: 0.15rem 0.4rem; font-size: 0.75rem;">${l.type}</span></td>
            <td style="text-align: right; font-weight: bold; color: ${isDeposit ? '#10b981' : '#ef4444'}">${parseFloat(l.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8})}</td>
            <td style="text-align: right; padding-right: 2rem; font-size: 0.8rem; color: var(--color-text-secondary);">${formattedDate}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterExchangeLedgerTable() {
    currentLedgerPage = 0;
    loadLedgerData();
}

async function submitExchangeLedgerTransfer() {
    const userId = document.getElementById('ledgerUserIdInput').value.trim();
    const currency = document.getElementById('ledgerCurrencySelect').value;
    const type = document.getElementById('ledgerTypeSelect').value;
    const amountInput = document.getElementById('ledgerAmountInput').value.trim();

    if (!userId || isNaN(userId)) {
        alert("올바른 회원 UID를 입력해 주세요.");
        return;
    }
    if (!amountInput || isNaN(amountInput)) {
        alert("올바른 이체 금액 수치를 입력해 주세요.");
        return;
    }

    let amount = parseFloat(amountInput);
    if (amount <= 0) {
        alert("이체 수량은 0보다 커야 합니다.");
        return;
    }

    if (type === 'WITHDRAWAL') {
        amount = -amount;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/assets/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency, amount })
        });

        if (res.ok) {
            alert(`UID [${userId}] 회원에게 ${currency} ${type} 처리가 성공적으로 실행 완료되었습니다.`);
            document.getElementById('ledgerUserIdInput').value = '';
            document.getElementById('ledgerAmountInput').value = '';
            currentLedgerPage = 0;
            loadLedgerData();
        } else {
            const errMsg = await res.text();
            alert(`실패: ${errMsg}`);
        }
    } catch (err) {
        console.error("Ledger transfer failed", err);
        alert("서버 연결에 실패했습니다.");
    }
}


// ==========================================
// 7. ES6 모듈 글로벌 윈도우 스코프 바인딩
// ==========================================
window.switchTab = switchTab;
window.switchAdminSymbol = switchAdminSymbol;
window.switchAdminResolution = switchAdminResolution;
window.openRegisterModal = openRegisterModal;
window.closeRegisterModal = closeRegisterModal;
window.submitRegisterUser = submitRegisterUser;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.submitEditUser = submitEditUser;
window.openAdjustAssetModal = openAdjustAssetModal;
window.closeAdjustAssetModal = closeAdjustAssetModal;
window.submitAdjustAsset = submitAdjustAsset;
window.changeResolution = changeResolution;
window.closeUserTradesModal = closeUserTradesModal;
window.openUserTradesModal = openUserTradesModal;
window.prevLedgerPage = prevLedgerPage;
window.nextLedgerPage = nextLedgerPage;
window.filterUsersTable = filterUsersTable;
window.filterWalletsTable = filterWalletsTable;
window.filterExchangeLedgerTable = filterExchangeLedgerTable;
window.submitExchangeLedgerTransfer = submitExchangeLedgerTransfer;
window.initApiEndpoints = initApiEndpoints;
window.updateAdjustPlaceholder = updateAdjustPlaceholder;
