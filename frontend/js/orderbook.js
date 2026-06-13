// 🌌 Dynamic Asymmetric High-Contrast Orderbook UI Module
import { state, books, logEntry } from './state.js';
import { addPriceTick } from './chart.js';
import { updateWalletUI } from './wallet.js';
import { monitorStopLimitOrders } from './terminal.js';

let obTooltipEl = null;
const ROWS_COUNT = 10; // 🌟 10 bids and 10 asks to display the full book depth!

export function initOrderbook() {
    // Generate 10 ask rows and 10 bid rows dynamically to avoid HTML pollution
    const askRowsContainer = document.getElementById('ask-rows');
    const bidRowsContainer = document.getElementById('bid-rows');

    if (askRowsContainer) {
        askRowsContainer.innerHTML = '';
        for (let i = 0; i < ROWS_COUNT; i++) {
            const row = document.createElement('div');
            row.className = 'ladder-row ask';
            row.id = `ask-row-${i}`;
            row.innerHTML = `
                <div class="ladder-cell ask-qty qty-cell"><div class="depth-bar"></div><span class="qty-value">--</span></div>
                <div class="ladder-cell price">--</div>
                <div class="ladder-cell bid-qty"></div>
            `;
            askRowsContainer.appendChild(row);
        }
    }

    if (bidRowsContainer) {
        bidRowsContainer.innerHTML = '';
        for (let i = 0; i < ROWS_COUNT; i++) {
            const row = document.createElement('div');
            row.className = 'ladder-row bid';
            row.id = `bid-row-${i}`;
            row.innerHTML = `
                <div class="ladder-cell ask-qty"></div>
                <div class="ladder-cell price">--</div>
                <div class="ladder-cell bid-qty qty-cell"><div class="depth-bar"></div><span class="qty-value">--</span></div>
            `;
            bidRowsContainer.appendChild(row);
        }
    }

    // Init tooltip element
    obTooltipEl = document.getElementById('ob-tooltip');
    if (!obTooltipEl) {
        obTooltipEl = document.createElement('div');
        obTooltipEl.id = 'ob-tooltip';
        obTooltipEl.className = 'ob-tooltip';
        document.body.appendChild(obTooltipEl);
    }

    // Bind ob-grouping event
    const groupingSelect = document.getElementById('ob-grouping');
    if (groupingSelect) {
        groupingSelect.onchange = changeGrouping;
    }

    updateOrderbookUI();
}

export function changeGrouping() {
    const val = parseInt(document.getElementById('ob-grouping').value) || 1;
    state.activeGroupingFactor = val;
    state.needsRender = true;
    logEntry('system', `호가 모아보기 병합 수준이 변경되었습니다: x${val}`);
}

export function fillPriceInput(scaledPrice) {
    const realPrice = scaledPrice / 100;
    const input = document.getElementById('order-price');
    if (input) {
        input.value = realPrice;
        // Trigger total calculation
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
    const unit = state.currentSymbol === 'BTC-USD' ? '$' : '₩';
    logEntry('system', `선택한 호가 가격 입력 완료: ${unit}${realPrice.toFixed(2)}`);
}

export function updateOrderbookUI() {
    const book = books[state.currentSymbol];
    if (!book) return;

    // Update column headers dynamically based on selected symbol
    const isBtc = state.currentSymbol === 'BTC-USD';
    const coin = isBtc ? 'BTC' : 'ADA';
    const fiat = isBtc ? 'USD' : 'KRW';

    const hdrAsk = document.getElementById('ob-hdr-ask');
    const hdrPrice = document.getElementById('ob-hdr-price');
    const hdrBid = document.getElementById('ob-hdr-bid');

    if (hdrAsk) hdrAsk.innerText = `매도 잔량 (${coin})`;
    if (hdrPrice) hdrPrice.innerText = `호가 (${fiat})`;
    if (hdrBid) hdrBid.innerText = `매수 잔량 (${coin})`;
    
    const groupFactor = state.activeGroupingFactor;

    // Aggregate books based on grouping factor
    const mergedBids = new Map();
    const mergedAsks = new Map();

    const stepScale = groupFactor * 100;

    for (const [price, qty] of book.bids.entries()) {
        if (qty <= 0) continue;
        const mergedPrice = Math.floor(price / stepScale) * stepScale;
        mergedBids.set(mergedPrice, (mergedBids.get(mergedPrice) || 0) + qty);
    }

    for (const [price, qty] of book.asks.entries()) {
        if (qty <= 0) continue;
        const mergedPrice = Math.floor(price / stepScale) * stepScale;
        mergedAsks.set(mergedPrice, (mergedAsks.get(mergedPrice) || 0) + qty);
    }

    // Sort asks (ascending) & slice to ROWS_COUNT
    const sortedAsks = Array.from(mergedAsks.entries())
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => a[0] - b[0])
        .slice(0, ROWS_COUNT);

    // Sort bids (descending) & slice to ROWS_COUNT
    const sortedBids = Array.from(mergedBids.entries())
        .filter(([_, qty]) => qty > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, ROWS_COUNT);

    let bidTotal = 0;
    let askTotal = 0;
    sortedBids.forEach(([_, qty]) => bidTotal += qty);
    sortedAsks.forEach(([_, qty]) => askTotal += qty);
    const maxDepth = Math.max(bidTotal, askTotal) || 1;

    // 1. Asks Rendering (from high to low index)
    for (let i = 0; i < ROWS_COUNT; i++) {
        const askIdx = (ROWS_COUNT - 1) - i;
        const askData = sortedAsks[askIdx];
        const rowEl = document.getElementById(`ask-row-${i}`);
        if (!rowEl) continue;

        const priceCell = rowEl.querySelector('.price');
        const qtyCell = rowEl.querySelector('.ask-qty');
        const qtyVal = qtyCell.querySelector('.qty-value');
        const depthBar = qtyCell.querySelector('.depth-bar');

        if (askData) {
            const [price, qty] = askData;
            const prev = book.lastRenderedAsks[i];

            const diffPercent = book.basePrice ? (((price / 100) - book.basePrice) / book.basePrice) * 100 : 0;
            const sign = diffPercent > 0 ? '+' : '';
            const percentText = `${sign}${diffPercent.toFixed(2)}%`;
            const changeClass = diffPercent > 0 ? 'up' : (diffPercent < 0 ? 'down' : 'stable');

            priceCell.innerHTML = `
                <div class="price-wrapper" style="display: flex; align-items: center; gap: 0.35rem; justify-content: center; width: 100%;">
                    <span class="price-val" style="font-weight: 700;">${(price / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span class="price-change ${changeClass}" style="font-size: 0.65rem; font-weight: bold; opacity: 0.85;">${percentText}</span>
                </div>
            `;
            qtyVal.innerText = qty.toLocaleString();
            rowEl.onclick = () => fillPriceInput(price);

            // Best execution price tag focus box
            if (price === state.lastTradePrice) {
                priceCell.classList.add('current-price-box');
            } else {
                priceCell.classList.remove('current-price-box');
            }

            // Bind tooltip events
            rowEl.onmouseenter = (e) => showObTooltip(e, 'ASK', price, sortedAsks);
            rowEl.onmousemove = moveObTooltip;
            rowEl.onmouseleave = hideObTooltip;

            const widthPercent = Math.min((qty / maxDepth) * 100, 100);
            depthBar.style.width = `${widthPercent}%`;

            // 기존 스타일: tr(rowEl) 안에 수량 비례 백그라운드 색상 채우기 (매도는 좌측 컬럼이므로 left->right 방향)
            rowEl.style.background = `linear-gradient(to right, rgba(239, 68, 68, 0.12) ${widthPercent}%, var(--color-ask-bg) ${widthPercent}%)`;

            // Neon flashing updates
            const flashState = state.priceFlashStates.get(price);
            if (flashState) {
                qtyCell.classList.remove('flash-ask-inc', 'flash-dec');
                void qtyCell.offsetWidth;
                qtyCell.classList.add(flashState === 'inc' ? 'flash-ask-inc' : 'flash-dec');
            } else if (prev && prev.price === price && prev.qty !== qty) {
                qtyCell.classList.remove('flash-ask-inc', 'flash-dec');
                void qtyCell.offsetWidth;
                qtyCell.classList.add(qty > prev.qty ? 'flash-ask-inc' : 'flash-dec');
            }

            book.lastRenderedAsks[i] = { price, qty };
        } else {
            priceCell.innerText = '--';
            qtyVal.innerText = '--';
            depthBar.style.width = '0%';
            rowEl.style.background = '';
            rowEl.onclick = null;
            rowEl.onmouseenter = null;
            rowEl.onmousemove = null;
            rowEl.onmouseleave = null;
            priceCell.classList.remove('current-price-box');
            book.lastRenderedAsks[i] = null;
        }
    }

    // 2. Bids Rendering (from index 0 downwards)
    for (let i = 0; i < ROWS_COUNT; i++) {
        const bidData = sortedBids[i];
        const rowEl = document.getElementById(`bid-row-${i}`);
        if (!rowEl) continue;

        const priceCell = rowEl.querySelector('.price');
        const qtyCell = rowEl.querySelector('.bid-qty');
        const qtyVal = qtyCell.querySelector('.qty-value');
        const depthBar = qtyCell.querySelector('.depth-bar');

        if (bidData) {
            const [price, qty] = bidData;
            const prev = book.lastRenderedBids[i];

            const diffPercent = book.basePrice ? (((price / 100) - book.basePrice) / book.basePrice) * 100 : 0;
            const sign = diffPercent > 0 ? '+' : '';
            const percentText = `${sign}${diffPercent.toFixed(2)}%`;
            const changeClass = diffPercent > 0 ? 'up' : (diffPercent < 0 ? 'down' : 'stable');

            priceCell.innerHTML = `
                <div class="price-wrapper" style="display: flex; align-items: center; gap: 0.35rem; justify-content: center; width: 100%;">
                    <span class="price-val" style="font-weight: 700;">${(price / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span class="price-change ${changeClass}" style="font-size: 0.65rem; font-weight: bold; opacity: 0.85;">${percentText}</span>
                </div>
            `;
            qtyVal.innerText = qty.toLocaleString();
            rowEl.onclick = () => fillPriceInput(price);

            if (price === state.lastTradePrice) {
                priceCell.classList.add('current-price-box');
            } else {
                priceCell.classList.remove('current-price-box');
            }

            rowEl.onmouseenter = (e) => showObTooltip(e, 'BID', price, sortedBids);
            rowEl.onmousemove = moveObTooltip;
            rowEl.onmouseleave = hideObTooltip;

            const widthPercent = Math.min((qty / maxDepth) * 100, 100);
            depthBar.style.width = `${widthPercent}%`;

            // 기존 스타일: tr(rowEl) 안에 수량 비례 백그라운드 색상 채우기 (매수도 우측 컬럼이므로 right->left 방향)
            rowEl.style.background = `linear-gradient(to left, rgba(16, 185, 129, 0.12) ${widthPercent}%, var(--color-bid-bg) ${widthPercent}%)`;

            const flashState = state.priceFlashStates.get(price);
            if (flashState) {
                qtyCell.classList.remove('flash-bid-inc', 'flash-dec');
                void qtyCell.offsetWidth;
                qtyCell.classList.add(flashState === 'inc' ? 'flash-bid-inc' : 'flash-dec');
            } else if (prev && prev.price === price && prev.qty !== qty) {
                qtyCell.classList.remove('flash-bid-inc', 'flash-dec');
                void qtyCell.offsetWidth;
                qtyCell.classList.add(qty > prev.qty ? 'flash-bid-inc' : 'flash-dec');
            }

            book.lastRenderedBids[i] = { price, qty };
        } else {
            priceCell.innerText = '--';
            qtyVal.innerText = '--';
            depthBar.style.width = '0%';
            rowEl.style.background = '';
            rowEl.onclick = null;
            rowEl.onmouseenter = null;
            rowEl.onmousemove = null;
            rowEl.onmouseleave = null;
            priceCell.classList.remove('current-price-box');
            book.lastRenderedBids[i] = null;
        }
    }

    // 3. Spreads display
    const bestBid = sortedBids.length > 0 ? sortedBids[0][0] : null;
    const bestAsk = sortedAsks.length > 0 ? sortedAsks[0][0] : null;

    const midPriceEl = document.getElementById('mid-price');
    const spreadGapEl = document.getElementById('spread-gap');

    if (bestBid && bestAsk) {
        const mid = (bestBid + bestAsk) / 2;
        const gap = bestAsk - bestBid;
        const gapPercent = (gap / mid) * 100;

        const midVal = mid / 100;
        const unit = state.currentSymbol === 'BTC-USD' ? '$' : '₩';
        
        if (midPriceEl) {
            const diff = midVal - book.basePrice;
            const diffPercent = book.basePrice ? (diff / book.basePrice) * 100 : 0;
            const sign = diff >= 0 ? '+' : '';
            const diffColor = diff > 0 ? '#ef4444' : (diff < 0 ? '#3b82f6' : '#94a3b8');

            midPriceEl.innerHTML = `
                <div class="mid-price-wrapper" style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                    <span class="mid-price-val">${unit}${midVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span class="mid-price-change" style="color: ${diffColor}; font-size: 0.75rem; font-weight: bold;">${sign}${diffPercent.toFixed(2)}%</span>
                </div>
            `;
        }
        
        if (spreadGapEl) {
            const isPriceUp = gapPercent > 0.02;
            spreadGapEl.innerText = `스프레드 갭: ${unit}${(gap / 100).toFixed(2)} (${gapPercent.toFixed(3)}%)`;
            spreadGapEl.className = isPriceUp ? 'spread-change up' : 'spread-change down';
        }

        // 24H 대비 등락률 실시간 산출 및 UI 렌더링
        const changeEl = document.getElementById('change-24h');
        if (changeEl && book.basePrice) {
            const diff = midVal - book.basePrice;
            const diffPercent = (diff / book.basePrice) * 100;
            const sign = diff >= 0 ? '+' : '';
            
            changeEl.innerText = `전일 대비: ${sign}${diffPercent.toFixed(2)}% (${sign}${unit}${Math.abs(diff).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})`;
            
            if (diff > 0) {
                changeEl.style.color = '#ef4444'; // 상승 시 레드(전통적 증권 컬러)
            } else if (diff < 0) {
                changeEl.style.color = '#3b82f6'; // 하락 시 블루
            } else {
                changeEl.style.color = '#94a3b8'; // 변동 없음 시 회색
            }
        }

        // [개선 완료] 실시간 차트는 오더북의 가상 중간가(midVal)가 아닌, gateway.js에서 처리되는 
        // 실제 체결(Executed Trades) 가격 기준(addPriceTick)으로만 일관되게 갱신되도록 변경하였습니다.
        // 이로써 화면 상의 현재 캔들과 F5 새로고침 후 DB에서 불러오는 역사 캔들의 모양이 100% 완벽히 일치하게 됩니다.
        // (이전 코드: addPriceTick(midVal);)

        // Monitor Stop-Limit trigger conditions
        monitorStopLimitOrders(midVal);
    } else {
        if (midPriceEl) midPriceEl.innerText = '--';
        if (spreadGapEl) spreadGapEl.innerText = '--';
        const changeEl = document.getElementById('change-24h');
        if (changeEl) changeEl.innerText = '전일 대비: --';
    }

    state.priceFlashStates.clear();
    updateWalletUI();
}

export function showObTooltip(event, side, targetPrice, sortedAsksOrBids) {
    if (!obTooltipEl) return;

    let accQty = 0;
    let accCost = 0;

    if (side === 'ASK') {
        for (const [p, q] of sortedAsksOrBids) {
            if (p > targetPrice) break;
            accQty += q;
            accCost += q * (p / 100);
        }
    } else {
        for (const [p, q] of sortedAsksOrBids) {
            if (p < targetPrice) break;
            accQty += q;
            accCost += q * (p / 100);
        }
    }

    const unit = state.currentSymbol === 'BTC-USD' ? '$' : '₩';
    const coinUnit = state.currentSymbol === 'BTC-USD' ? 'BTC' : 'ADA';

    obTooltipEl.style.display = 'block';
    obTooltipEl.innerHTML = `
        <div style="font-weight: 800; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 2px; margin-bottom: 4px; color: #fff; font-size: 0.65rem;">누적 정보 (${side === 'ASK' ? '매도' : '매수'})</div>
        <div style="display:flex; justify-content:space-between; gap:1.2rem; font-size: 0.65rem;"><span>평균가:</span> <span style="font-weight:700;">${unit}${(targetPrice/100).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
        <div style="display:flex; justify-content:space-between; gap:1.2rem; font-size: 0.65rem;"><span>누적량:</span> <span style="font-weight:700; color:#00f2fe;">${accQty.toLocaleString()} ${coinUnit}</span></div>
        <div style="display:flex; justify-content:space-between; gap:1.2rem; font-size: 0.65rem;"><span>누적액:</span> <span style="font-weight:700; color:#ef4444;">${unit}${accCost.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
    `;

    moveObTooltip(event);
}

export function moveObTooltip(event) {
    if (!obTooltipEl || obTooltipEl.style.display === 'none') return;
    obTooltipEl.style.left = `${event.pageX + 18}px`;
    obTooltipEl.style.top = `${event.pageY - 30}px`;
}

export function hideObTooltip() {
    if (obTooltipEl) {
        obTooltipEl.style.display = 'none';
    }
}
