// 🌌 main application entry point and orchestrator
import { state, logEntry, alertBubble, books } from './state.js';
import { initGateway, renderTradeHistoryUI } from './gateway.js';
import { initOrderbook, updateOrderbookUI } from './orderbook.js';
import { initChart, resizeCanvas, drawPriceChart, fetchAndLoadHistoricalCandles } from './chart.js';
import { initWallet, updateWalletUI } from './wallet.js';
import { initTerminal, setRatioPreset } from './terminal.js';
import { logDeviceSession } from './auth.js';
import { getActiveWalletService } from './walletService.js';

// Market coins mapping for mock and display
const marketCoins = [
    { id: 'BTC-USD', name: '비트코인', symbol: 'BTC/USD', fiat: 'USD', basePrice: 65000 },
    { id: 'ETH-USD', name: '이더리움', symbol: 'ETH/USD', fiat: 'USD', basePrice: 3500 },
    { id: 'XRP-USD', name: '리플', symbol: 'XRP/USD', fiat: 'USD', basePrice: 0.52 },
    { id: 'DOGE-USD', name: '도지코인', symbol: 'DOGE/USD', fiat: 'USD', basePrice: 0.15 },
    { id: 'ADA-KRW', name: '에이다', symbol: 'ADA/KRW', fiat: 'KRW', basePrice: 500 },
    { id: 'SOL-KRW', name: '솔라나', symbol: 'SOL/KRW', fiat: 'KRW', basePrice: 220000 }
];

let activeMarketTab = 'USD';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize all submodules
    initChart();
    initOrderbook();
    initWallet();
    initTerminal();
    initGateway();

    // Initialize sandbox/production toggle button
    initModeToggle();

    // Load initial wallet/balances/ledger from active service
    const service = getActiveWalletService();
    service.getBalances().then(() => {
        service.getLedger().then(() => {
            updateWalletUI();
        });
    });

    // 2. Log mock device audit session
    logDeviceSession();

    // 3. Bind UI elements and handlers
    bindUIEvents();

    // Sync initial symbol price from server
    syncLastPriceFromServer(state.currentSymbol);

    // 4. Start animation render loop
    requestAnimationFrame(renderLoop);

    // Initial render
    renderMarketListUI();
    setInterval(renderMarketListUI, 1000); // refresh prices in list
});

function renderLoop() {
    if (state.needsRender) {
        updateOrderbookUI();
        state.needsRender = false;
    }
    requestAnimationFrame(renderLoop);
}

function bindUIEvents() {
    // Symbol Switchers
    const btcBtn = document.getElementById('symbol-btn-btc');
    const adaBtn = document.getElementById('symbol-btn-ada');

    if (btcBtn) btcBtn.onclick = () => switchSymbol('BTC-USD');
    if (adaBtn) adaBtn.onclick = () => switchSymbol('ADA-KRW');

    // Buy/Sell Side Toggles
    const buyBtn = document.getElementById('side-buy');
    const sellBtn = document.getElementById('side-sell');
    if (buyBtn) buyBtn.onclick = () => setSide('BUY');
    if (sellBtn) sellBtn.onclick = () => setSide('SELL');

    // Market Search
    const searchInput = document.getElementById('market-search');
    if (searchInput) {
        searchInput.oninput = renderMarketListUI;
    }

    // Market Tabs
    const tabUsd = document.getElementById('market-tab-usd');
    const tabKrw = document.getElementById('market-tab-krw');

    if (tabUsd) tabUsd.onclick = () => switchMarketTab('USD');
    if (tabKrw) tabKrw.onclick = () => switchMarketTab('KRW');

    // ⏱️ 차트 시간 해상도 변경 버튼 클릭 이벤트 매핑 (한글 주석 장착)
    const resButtons = {
        '1m': document.getElementById('res-btn-1m'),
        '5m': document.getElementById('res-btn-5m'),
        '15m': document.getElementById('res-btn-15m'),
        '1h': document.getElementById('res-btn-1h')
    };

    Object.entries(resButtons).forEach(([res, btn]) => {
        if (btn) {
            btn.onclick = () => {
                // 이미 활성화된 해상도인 경우 무시합니다.
                if (state.activeResolution === res) return;

                // 모든 버튼에서 active 스타일 제거 후 클릭한 버튼만 활성화
                Object.values(resButtons).forEach(b => b?.classList.remove('active'));
                btn.classList.add('active');

                // 전역 상태에 활성 해상도 저장 및 차트 데이터 재로딩 트리거
                state.activeResolution = res;
                const basePrice = state.currentSymbol === 'BTC-USD' ? 65000 : 500;
                
                // 실제 DB 캔들 데이터를 새로운 시간 단위 해상도로 즉시 갱신합니다.
                fetchAndLoadHistoricalCandles(state.currentSymbol, basePrice, res);
                logEntry('system', `차트 해상도가 ${res.toUpperCase()} 단위로 정상 전환되었습니다.`);
            };
        }
    });

    // Default Side side-toggle setup
    setSide('BUY');
}

function setSide(side) {
    state.selectedSide = side;
    const buyBtn = document.getElementById('side-buy');
    const sellBtn = document.getElementById('side-sell');
    const submitBtn = document.getElementById('submit-order-btn');

    if (!buyBtn || !sellBtn || !submitBtn) return;

    const actionKo = side === 'BUY' ? '매수' : '매도';

    if (side === 'BUY') {
        buyBtn.classList.add('active');
        sellBtn.classList.remove('active');
        submitBtn.className = 'btn-submit buy';
        submitBtn.innerText = `${actionKo} 주문 전송`;
    } else {
        buyBtn.classList.remove('active');
        sellBtn.classList.add('active');
        submitBtn.className = 'btn-submit sell';
        submitBtn.innerText = `${actionKo} 주문 전송`;
    }
    
    // Refresh totals
    const event = new Event('input', { bubbles: true });
    document.getElementById('order-qty')?.dispatchEvent(event);
}

async function syncLastPriceFromServer(symbol) {
    const host = window.location.hostname || 'localhost';
    const url = `http://${host}:8181/admin/stats/ticker?symbol=${symbol}`;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data.lastPrice) {
                const actualPrice = data.lastPrice / 100;
                state.lastTradePrice = data.lastPrice;
                
                // Fetch and load actual database-backed historical candles centered around actual price
                fetchAndLoadHistoricalCandles(symbol, actualPrice, state.activeResolution);

                const orderPriceInput = document.getElementById('order-price');
                if (orderPriceInput) {
                    orderPriceInput.value = actualPrice;
                    // Trigger calculation updates
                    const event = new Event('input', { bubbles: true });
                    orderPriceInput.dispatchEvent(event);
                }
            }
        }
    } catch (e) {
        console.error('Failed to sync last price from server:', e);
    }
}

function switchSymbol(symbol) {
    if (state.currentSymbol === symbol) return;
    state.currentSymbol = symbol;

    const btcBtn = document.getElementById('symbol-btn-btc');
    const adaBtn = document.getElementById('symbol-btn-ada');

    if (btcBtn && adaBtn) {
        if (symbol === 'BTC-USD') {
            btcBtn.classList.add('active');
            adaBtn.classList.remove('active');
        } else {
            btcBtn.classList.remove('active');
            adaBtn.classList.add('active');
        }
    }

    const priceLabel = document.querySelector('#order-price')?.parentNode?.querySelector('.input-suffix');
    const qtyLabel = document.querySelector('#order-qty')?.parentNode?.querySelector('.input-suffix');
    
    if (priceLabel && qtyLabel) {
        if (symbol === 'BTC-USD') {
            priceLabel.innerText = 'USD';
            qtyLabel.innerText = 'BTC';
            document.getElementById('order-price').value = 65000;
            document.getElementById('order-qty').value = 5;
            state.lastTradePrice = 6500000;
            
            const presets = document.querySelectorAll('.preset-btn');
            if (presets.length >= 4) {
                // Remove onClick attributes and bind custom presets
                presets[0].innerText = '1 BTC'; presets[0].onclick = () => setQtyPreset(1);
                presets[1].innerText = '5 BTC'; presets[1].onclick = () => setQtyPreset(5);
                presets[2].innerText = '10 BTC'; presets[2].onclick = () => setQtyPreset(10);
                presets[3].innerText = '50 BTC'; presets[3].onclick = () => setQtyPreset(50);
            }
        } else {
            priceLabel.innerText = 'KRW';
            qtyLabel.innerText = 'ADA';
            document.getElementById('order-price').value = 500;
            document.getElementById('order-qty').value = 1000;
            state.lastTradePrice = 50000;

            const presets = document.querySelectorAll('.preset-btn');
            if (presets.length >= 4) {
                presets[0].innerText = '100 ADA'; presets[0].onclick = () => setQtyPreset(100);
                presets[1].innerText = '500 ADA'; presets[1].onclick = () => setQtyPreset(500);
                presets[2].innerText = '1000 ADA'; presets[2].onclick = () => setQtyPreset(1000);
                presets[3].innerText = '5000 ADA'; presets[3].onclick = () => setQtyPreset(5000);
            }
        }
    }

    setSide(state.selectedSide);
    
    // Clear inputs values
    const stopInput = document.getElementById('order-stop-price');
    if (stopInput) {
        stopInput.value = symbol === 'BTC-USD' ? '64000' : '490';
    }

    // Trigger calculation updates
    const event = new Event('input', { bubbles: true });
    document.getElementById('order-qty')?.dispatchEvent(event);
    
    // Fetch and load actual database historical candles centered around baseline price instantly
    fetchAndLoadHistoricalCandles(symbol, symbol === 'BTC-USD' ? 65000 : 500, state.activeResolution);

    // Redraw and rebind elements
    updateOrderbookUI();
    renderTradeHistoryUI();
    renderMarketListUI();
    resizeCanvas();
    drawPriceChart();
    
    // Sync true current price from backend stats service dynamically
    syncLastPriceFromServer(symbol);
    
    logEntry('system', `거래 종목 전환 완료: ${symbol}`);
}

function setQtyPreset(qty) {
    const input = document.getElementById('order-qty');
    if (input) {
        input.value = qty;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
}

function renderMarketListUI() {
    const tbody = document.getElementById('market-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const searchKeyword = (document.getElementById('market-search')?.value || '').toLowerCase();

    marketCoins.forEach(coin => {
        if (coin.fiat !== activeMarketTab) return;

        const nameMatches = coin.name.toLowerCase().includes(searchKeyword);
        const symbolMatches = coin.id.toLowerCase().includes(searchKeyword);
        if (!nameMatches && !symbolMatches) return;

        // Fetch live state price if available
        let livePrice = coin.basePrice;
        const book = books[coin.id];
        if (book) {
            const sortedBids = Array.from(book.bids.entries()).filter(([_, q]) => q > 0).sort((a,b)=>b[0]-a[0]);
            const sortedAsks = Array.from(book.asks.entries()).filter(([_, q]) => q > 0).sort((a,b)=>a[0]-b[0]);
            if (sortedBids.length > 0 && sortedAsks.length > 0) {
                livePrice = ((sortedBids[0][0] + sortedAsks[0][0]) / 2) / 100;
            }
        }

        const unit = coin.fiat === 'USD' ? '$' : '₩';
        const isSelected = coin.id === state.currentSymbol;

        const row = document.createElement('tr');
        if (isSelected) {
            row.className = 'active-market-row';
        }
        row.style.cursor = 'pointer';
        row.onclick = () => {
            if (coin.id === 'BTC-USD' || coin.id === 'ADA-KRW') {
                switchSymbol(coin.id);
            } else {
                alertBubble(`${coin.name} 마켓은 전시용 코인입니다. BTC 또는 ADA 마켓을 이용해주세요!`, 'rgba(138, 43, 226, 0.95)');
            }
        };

        const mockChange = coin.id === 'BTC-USD' ? '-0.25%' : (coin.id === 'ADA-KRW' ? '+0.16%' : '+0.00%');
        const mockColor = mockChange.startsWith('+') ? '#ef4444' : (mockChange.startsWith('-') ? '#3b82f6' : '#fff');

        row.innerHTML = `
            <td style="text-align: left; padding: 0.5rem 0.75rem; font-weight: 700;">
                <span style="color: #fff; display: block; font-size: 0.75rem;">${coin.name}</span>
                <span style="color: var(--color-text-secondary); font-size: 0.65rem;">${coin.symbol}</span>
            </td>
            <td style="font-family: var(--font-mono); font-weight: 700; text-align: right; padding: 0.5rem 0.75rem; color: ${mockColor};">
                ${unit}${livePrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
            <td style="font-family: var(--font-mono); text-align: right; padding: 0.5rem 0.75rem; color: ${mockColor}; font-weight: 600;">
                ${mockChange}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function switchMarketTab(fiat) {
    activeMarketTab = fiat;
    
    const tabUsd = document.getElementById('market-tab-usd');
    const tabKrw = document.getElementById('market-tab-krw');

    if (tabUsd && tabKrw) {
        tabUsd.className = fiat === 'USD' ? 'side-btn buy active' : 'side-btn buy';
        tabKrw.className = fiat === 'KRW' ? 'side-btn buy active' : 'side-btn buy';
    }
    renderMarketListUI();
}

function initModeToggle() {
    const btn = document.getElementById('mode-toggle-btn');
    const txt = document.getElementById('mode-text');
    
    if (!btn) return;
    
    const updateBtnUI = () => {
        if (state.isLive) {
            btn.className = 'mode-toggle-btn production';
            if (txt) txt.innerText = '실거래 모드 (Live DB)';
            logEntry('auth', '서버 데이터베이스(Live DB) 연동 실거래 모드로 전환되었습니다.');
        } else {
            btn.className = 'mode-toggle-btn sandbox';
            if (txt) txt.innerText = '모의투자 모드 (Local Cache)';
            logEntry('auth', '로컬스토리지 모의투자 모드로 전환되었습니다.');
        }
    };
    
    // Initial sync
    updateBtnUI();
    
    btn.onclick = () => {
        state.isLive = !state.isLive;
        localStorage.setItem('hfx_is_live', JSON.stringify(state.isLive));
        updateBtnUI();
        
        // Refresh wallet state
        const service = getActiveWalletService();
        service.getBalances().then(() => {
            service.getLedger().then(() => {
                updateWalletUI();
                alertBubble(state.isLive ? '실거래 모드(Live DB)로 전환되었습니다.' : '모의투자 모드(Local Cache)로 전환되었습니다.', state.isLive ? 'rgba(16, 185, 129, 0.95)' : 'rgba(245, 158, 11, 0.95)');
            });
        });
    };
}
