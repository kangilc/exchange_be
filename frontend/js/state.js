// 🌌 Global State Module for real-time exchange portal
export const defaultBalances = {
    KRW: 1000000000,
    USD: 10000,
    BTC: 10.0,
    ADA: 100000.0
};

export const state = {
    ws: null,
    selectedSide: 'BUY',
    currentSymbol: 'BTC-USD',
    backoffDelay: 1000,
    pingIntervalId: null,
    needsRender: false,
    lastTradePrice: 6500000, // scaled by 100
    
    balances: JSON.parse(localStorage.getItem('hfx_balances')) || { ...defaultBalances },
    myPortfolio: JSON.parse(localStorage.getItem('hfx_portfolio')) || {
        'BTC-USD': { qty: 10.0, avgPrice: 65000 },
        'ADA-KRW': { qty: 100000.0, avgPrice: 500 }
    },
    
    recentTradesForPower: [],
    activeGroupingFactor: 1,
    priceFlashStates: new Map(),
    
    // 2FA Auth State
    is2FAVerified: false,
    otpSecret: "J4V4FX2FASECUREKEY", // Mock secret for simulation
    
    // Stop-limit orders
    stopLimitOrders: JSON.parse(localStorage.getItem('hfx_stop_limit_orders')) || [],
    
    // Deposit/Withdrawal logs
    ledger: JSON.parse(localStorage.getItem('hfx_ledger')) || [],
};

// Java String.hashCode() mapping in JS to match symbolId
export function getHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash);
}

export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

// Initialize local order book and chart data structure
export const books = {
    'BTC-USD': {
        bids: new Map(),
        asks: new Map(),
        lastRenderedAsks: new Array(10).fill(null),
        lastRenderedBids: new Array(10).fill(null),
        priceHistory: [],
        tradeHistory: []
    },
    'ADA-KRW': {
        bids: new Map(),
        asks: new Map(),
        lastRenderedAsks: new Array(10).fill(null),
        lastRenderedBids: new Array(10).fill(null),
        priceHistory: [],
        tradeHistory: []
    }
};

export function saveWallet() {
    localStorage.setItem('hfx_balances', JSON.stringify(state.balances));
    localStorage.setItem('hfx_portfolio', JSON.stringify(state.myPortfolio));
    localStorage.setItem('hfx_stop_limit_orders', JSON.stringify(state.stopLimitOrders));
    localStorage.setItem('hfx_ledger', JSON.stringify(state.ledger));
    
    // Dispatch custom event to notify other modules
    window.dispatchEvent(new CustomEvent('walletUpdated'));
}

export function resetWallet() {
    state.balances = { ...defaultBalances };
    state.myPortfolio = {
        'BTC-USD': { qty: 10.0, avgPrice: 65000 },
        'ADA-KRW': { qty: 100000.0, avgPrice: 500 }
    };
    state.stopLimitOrders = [];
    state.ledger = [];
    state.is2FAVerified = false;
    saveWallet();
}

// Log utility
export function logEntry(tag, message) {
    const logsContainer = document.getElementById('event-logs');
    if (!logsContainer) return;
    
    const timeStr = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    let tagKo = '시스템';
    if (tag === 'buy') tagKo = '매수';
    if (tag === 'sell') tagKo = '매도';
    if (tag === 'warning') tagKo = '주의';
    if (tag === 'auth') tagKo = '보안';
    if (tag === 'wallet') tagKo = '입출금';

    entry.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-tag ${tag}">${tagKo}</span>
        <span class="log-msg">${message}</span>
    `;

    logsContainer.insertBefore(entry, logsContainer.firstChild);

    if (logsContainer.children.length > 50) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

// Alert Bubble utility
export function alertBubble(msg, bgColor) {
    const bubble = document.createElement('div');
    bubble.className = 'alert-bubble';
    if (bgColor) bubble.style.background = bgColor;
    bubble.innerText = msg;

    document.body.appendChild(bubble);
    setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translateY(-20px)';
        setTimeout(() => bubble.remove(), 400);
    }, 2500);
}
