// 🌌 Advanced Order Terminal & Stop-Limit Order Controller
import { state, saveWallet, logEntry, alertBubble } from './state.js';
import { updateWalletUI } from './wallet.js';
import { getActiveWalletService } from './walletService.js';

export let activeTab = 'LIMIT'; // LIMIT, MARKET, STOP_LIMIT

export function initTerminal() {
    // Inject Tab switcher to order form header if not present
    const formHeader = document.querySelector('.panel.order-terminal-panel .panel-header');
    if (formHeader && !document.getElementById('terminal-tabs')) {
        const tabs = document.createElement('div');
        tabs.id = 'terminal-tabs';
        tabs.className = 'terminal-tabs-container';
        tabs.innerHTML = `
            <button id="term-tab-limit" class="term-tab active">지정가</button>
            <button id="term-tab-market" class="term-tab">시장가</button>
            <button id="term-tab-stop" class="term-tab">예약주문</button>
        `;
        formHeader.appendChild(tabs);

        // Bind events
        document.getElementById('term-tab-limit').onclick = () => switchTab('LIMIT');
        document.getElementById('term-tab-market').onclick = () => switchTab('MARKET');
        document.getElementById('term-tab-stop').onclick = () => switchTab('STOP_LIMIT');
    }

    // Set default triggers
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) {
        submitBtn.onclick = handleOrderSubmit;
    }

    // Add Stop-Limit Active Orders Log if not present
    const mainCol = document.querySelector('.dashboard-container');
    if (mainCol && !document.getElementById('active-orders-panel')) {
        const panel = document.createElement('div');
        panel.id = 'active-orders-panel';
        panel.className = 'panel active-orders-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">🛡️ 실시간 대기 예약 주문</div>
            </div>
            <div class="panel-body">
                <div class="orders-table-container">
                    <table class="orders-table">
                        <thead>
                            <tr>
                                <th>시간</th>
                                <th>감시가</th>
                                <th>주문가</th>
                                <th>수량</th>
                                <th>취소</th>
                            </tr>
                        </thead>
                        <tbody id="active-orders-tbody">
                            <!-- Injected rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        mainCol.appendChild(panel);
    }

    // Connect preset buttons click
    const preset1 = document.getElementById('preset-1') || document.querySelector('.preset-btn:nth-child(1)');
    const preset2 = document.getElementById('preset-2') || document.querySelector('.preset-btn:nth-child(2)');
    const preset3 = document.getElementById('preset-3') || document.querySelector('.preset-btn:nth-child(3)');
    const preset4 = document.getElementById('preset-4') || document.querySelector('.preset-btn:nth-child(4)');

    if (preset1) preset1.onclick = () => setRatioPreset(0.1);
    if (preset2) preset2.onclick = () => setRatioPreset(0.25);
    if (preset3) preset3.onclick = () => setRatioPreset(0.5);
    if (preset4) preset4.onclick = () => setRatioPreset(1.0);

    // Watch key inputs for quantity and price shifts
    const orderQty = document.getElementById('order-qty');
    const orderPrice = document.getElementById('order-price');
    const stopPrice = document.getElementById('order-stop-price');

    if (orderQty) orderQty.oninput = updateTotalAmount;
    if (orderPrice) orderPrice.oninput = updateTotalAmount;
    if (stopPrice) stopPrice.oninput = updateTotalAmount;

    // Incremental adjusting buttons
    const adjustQtyMinus = document.getElementById('qty-adjust-minus');
    const adjustQtyPlus = document.getElementById('qty-adjust-plus');
    const adjustPriceMinus = document.getElementById('price-adjust-minus');
    const adjustPricePlus = document.getElementById('price-adjust-plus');

    if (adjustQtyMinus) adjustQtyMinus.onclick = () => adjustInput('order-qty', -1);
    if (adjustQtyPlus) adjustQtyPlus.onclick = () => adjustInput('order-qty', 1);
    if (adjustPriceMinus) adjustPriceMinus.onclick = () => adjustInput('order-price', -1);
    if (adjustPricePlus) adjustPricePlus.onclick = () => adjustInput('order-price', 1);

    renderStopLimitOrders();
}

export function switchTab(tab) {
    activeTab = tab;
    
    // UI tabs update
    document.querySelectorAll('.term-tab').forEach(el => el.classList.remove('active'));
    if (tab === 'LIMIT') document.getElementById('term-tab-limit').classList.add('active');
    if (tab === 'MARKET') document.getElementById('term-tab-market').classList.add('active');
    if (tab === 'STOP_LIMIT') document.getElementById('term-tab-stop').classList.add('active');

    // Trigger form inputs visibility
    const priceWrapper = document.getElementById('order-price-group');
    const stopPriceWrapper = document.getElementById('order-stop-price-group');

    if (tab === 'LIMIT') {
        if (priceWrapper) priceWrapper.style.display = 'flex';
        if (stopPriceWrapper) stopPriceWrapper.style.display = 'none';
    } else if (tab === 'MARKET') {
        if (priceWrapper) priceWrapper.style.display = 'none';
        if (stopPriceWrapper) stopPriceWrapper.style.display = 'none';
    } else if (tab === 'STOP_LIMIT') {
        if (priceWrapper) priceWrapper.style.display = 'flex';
        if (stopPriceWrapper) stopPriceWrapper.style.display = 'flex';
    }

    updateTotalAmount();
}

async function handleOrderSubmit() {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
        alertBubble('터미널 연결 끊김!', 'rgba(239, 68, 68, 0.95)');
        return;
    }

    const priceInput = parseFloat(document.getElementById('order-price').value);
    const qtyInput = parseFloat(document.getElementById('order-qty').value);
    const stopPriceInput = parseFloat(document.getElementById('order-stop-price')?.value);

    const isBtc = state.currentSymbol === 'BTC-USD';
    const coin = isBtc ? 'BTC' : 'ADA';
    const fiat = isBtc ? 'USD' : 'KRW';

    if (isNaN(qtyInput) || qtyInput <= 0) {
        alertBubble('수량이 올바르지 않습니다.', 'rgba(239, 68, 68, 0.95)');
        return;
    }

    // Process Market price fetching if MARKET is chosen
    let targetPrice = priceInput;
    if (activeTab === 'MARKET') {
        // Fallback to lastTradePrice or mid-price
        targetPrice = state.lastTradePrice / 100;
    } else if (isNaN(priceInput) || priceInput <= 0) {
        alertBubble('가격을 올바르게 입력해주세요.', 'rgba(239, 68, 68, 0.95)');
        return;
    }

    if (activeTab === 'STOP_LIMIT') {
        if (isNaN(stopPriceInput) || stopPriceInput <= 0) {
            alertBubble('감시가(Stop Price)를 설정해주세요.', 'rgba(239, 68, 68, 0.95)');
            return;
        }

        // Safe addition to local Stop-Limit queue
        const newOrder = {
            id: 'SLO-' + Math.floor(100000 + Math.random() * 900000),
            symbol: state.currentSymbol,
            side: state.selectedSide,
            stopPrice: stopPriceInput,
            price: targetPrice,
            qty: qtyInput,
            time: new Date().toLocaleTimeString(),
            status: '감시 중'
        };

        state.stopLimitOrders.push(newOrder);
        saveWallet();
        renderStopLimitOrders();
        
        logEntry("warning", `예약 주문 접수: 감시가 ${stopPriceInput} ${fiat} / 주문가 ${targetPrice} ${fiat}`);
        alertBubble("예약주문(Stop-Limit)이 성공적으로 활성화되었습니다.");
        return;
    }

    // standard execution (LIMIT or MARKET)
    const orderTotal = targetPrice * qtyInput;

    const service = getActiveWalletService();
    const balances = state.balances;

    if (state.selectedSide === 'BUY') {
        if ((balances[fiat] || 0) < orderTotal) {
            alertBubble(`자산 부족! 가용 ${fiat} 잔액이 부족합니다.`, 'rgba(239, 68, 68, 0.95)');
            return;
        }
    } else {
        if ((balances[coin] || 0) < qtyInput) {
            alertBubble(`자산 부족! 보유 ${coin} 수량이 부족합니다.`, 'rgba(239, 68, 68, 0.95)');
            return;
        }
    }

    // Delegate balance/portfolio deduction to active WalletService
    await service.deductOrderCost(fiat, coin, orderTotal, qtyInput, state.selectedSide);
    updateWalletUI();

    // Scale to match match-engine
    const scaledPrice = Math.round(targetPrice * 100);

    const payload = {
        action: 'NEW',
        symbol: state.currentSymbol,
        side: state.selectedSide,
        price: scaledPrice,
        qty: Math.round(qtyInput)
    };

    state.ws.send(JSON.stringify(payload));
    logEntry(state.selectedSide.toLowerCase(), `주문 성립 [${state.currentSymbol}]: ${qtyInput.toLocaleString()} ${coin} @ ${targetPrice.toFixed(2)}`);
    alertBubble(`${state.selectedSide === 'BUY' ? '매수' : '매도'} 주문이 즉시 전송되었습니다.`);
}

export function cancelStopLimitOrder(id) {
    state.stopLimitOrders = state.stopLimitOrders.filter(o => o.id !== id);
    saveWallet();
    renderStopLimitOrders();
    logEntry("warning", "예약주문(Stop-Limit)이 취소되었습니다.");
    alertBubble("예약주문 취소 완료", "rgba(239,68,68,0.9)");
}

export function renderStopLimitOrders() {
    const tbody = document.getElementById('active-orders-tbody');
    if (!tbody) return;

    if (state.stopLimitOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:1rem;">현재 대기 중인 예약 주문이 없습니다.</td></tr>`;
        return;
    }

    const fiat = state.currentSymbol === 'BTC-USD' ? 'USD' : 'KRW';
    const coin = state.currentSymbol === 'BTC-USD' ? 'BTC' : 'ADA';

    tbody.innerHTML = state.stopLimitOrders.map(order => `
        <tr class="${order.side === 'BUY' ? 'buy' : 'sell'}">
            <td>${order.time}</td>
            <td>${order.stopPrice.toLocaleString()} ${fiat}</td>
            <td>${order.price.toLocaleString()} ${fiat}</td>
            <td>${order.qty.toLocaleString()} ${coin}</td>
            <td>
                <button class="btn-cancel-sl" data-id="${order.id}">&times;</button>
            </td>
        </tr>
    `).join('');

    // Bind cancellations
    tbody.querySelectorAll('.btn-cancel-sl').forEach(btn => {
        btn.onclick = (e) => {
            const orderId = e.target.getAttribute('data-id');
            cancelStopLimitOrder(orderId);
        };
    });
}

// Watch stop prices and trigger matches locally for realism
export function monitorStopLimitOrders(midPrice) {
    let changed = false;
    
    state.stopLimitOrders.forEach(order => {
        if (order.status === '감시 중' && order.symbol === state.currentSymbol) {
            let isTriggered = false;
            // BUY triggers if price rises above stopPrice, SELL triggers if price drops below stopPrice
            if (order.side === 'BUY' && midPrice >= order.stopPrice) {
                isTriggered = true;
            } else if (order.side === 'SELL' && midPrice <= order.stopPrice) {
                isTriggered = true;
            }

            if (isTriggered) {
                order.status = '트리거됨';
                changed = true;
                
                // Expose to trade engine
                const scaledPrice = Math.round(order.price * 100);
                const payload = {
                    action: 'NEW',
                    symbol: order.symbol,
                    side: order.side,
                    price: scaledPrice,
                    qty: Math.round(order.qty)
                };

                state.ws.send(JSON.stringify(payload));
                logEntry("warning", `[예약 조건 달성] ${order.id} 주문이 시장에 전송되었습니다!`);
                alertBubble("예약주문 조건 도달 및 시장 접수!");
            }
        }
    });

    if (changed) {
        // Clear triggered
        state.stopLimitOrders = state.stopLimitOrders.filter(o => o.status !== '트리거됨');
        saveWallet();
        renderStopLimitOrders();
    }
}

export function setRatioPreset(ratio) {
    const isBtc = state.currentSymbol === 'BTC-USD';
    const coin = isBtc ? 'BTC' : 'ADA';
    const fiat = isBtc ? 'USD' : 'KRW';
    
    let price = parseFloat(document.getElementById('order-price').value);
    if (activeTab === 'MARKET') {
        price = state.lastTradePrice / 100;
    }

    if (isNaN(price) || price <= 0) {
        alertBubble('가격을 먼저 올바르게 기입해주세요.', 'rgba(239, 68, 68, 0.95)');
        return;
    }

    let qty = 0;
    if (state.selectedSide === 'BUY') {
        const availFiat = state.balances[fiat];
        qty = (availFiat * ratio) / price;
        qty = isBtc ? Math.floor(qty * 10000) / 10000 : Math.floor(qty * 100) / 100;
    } else {
        const availCoin = state.balances[coin];
        qty = availCoin * ratio;
        qty = isBtc ? Math.floor(qty * 10000) / 10000 : Math.floor(qty * 100) / 100;
    }

    document.getElementById('order-qty').value = Math.max(0, qty);
    updateTotalAmount();
}

export function adjustInput(id, delta) {
    const input = document.getElementById(id);
    let val = parseFloat(input.value) || 0;
    const step = state.currentSymbol === 'BTC-USD' ? 1 : 10;
    const actualDelta = id === 'order-price' ? (delta * step) : delta;
    val = Math.max(0, val + actualDelta);
    input.value = val;
    updateTotalAmount();
}

export function updateTotalAmount() {
    let price = parseFloat(document.getElementById('order-price').value);
    if (activeTab === 'MARKET') {
        price = state.lastTradePrice / 100;
    }
    const qty = parseFloat(document.getElementById('order-qty').value) || 0;
    
    if (isNaN(price)) price = 0;
    
    const total = price * qty;
    const unit = state.currentSymbol === 'BTC-USD' ? '$' : '₩';
    const totalEl = document.getElementById('total-amount');
    if (totalEl) {
        totalEl.innerText = unit + total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
