// 🌌 Low-latency WebSocket binary gateway connector
import { state, books, BTC_SYMBOL_ID, ADA_SYMBOL_ID, logEntry, alertBubble } from './state.js';
import { updateOrderbookUI } from './orderbook.js';

let msgCount = 0;
let lastSpeedTime = Date.now();

export function initGateway() {
    // Speed tracking throughput timer
    setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastSpeedTime) / 1000;
        const tps = Math.round(msgCount / elapsed);
        const tpsDisplay = document.getElementById('throughput-display');
        if (tpsDisplay) {
            tpsDisplay.innerText = `${tps} msgs/s`;
        }

        const latencyDisplay = document.getElementById('latency-display');
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
            if (latencyDisplay) latencyDisplay.innerText = `-- ms`;
        }

        msgCount = 0;
        lastSpeedTime = now;
    }, 1000);

    connect();
}

export function connect() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8088/ws`;

    logEntry('system', `웹소켓 게이트웨이에 연결 중: ${wsUrl}`);
    state.ws = new WebSocket(wsUrl);
    state.ws.binaryType = 'arraybuffer';

    state.ws.onopen = () => {
        const dot = document.getElementById('connection-dot');
        if (dot) {
            dot.className = 'status-dot connected';
            dot.style.backgroundColor = '';
            dot.style.boxShadow = '';
        }
        
        const txt = document.getElementById('connection-text');
        if (txt) {
            txt.innerText = '연결됨';
            txt.style.color = '#10b981';
        }
        
        logEntry('system', '연결 성공! 실시간 바이너리 멀티 심볼 스트림 구독 시작.');
        state.backoffDelay = 1000;
        
        if (state.pingIntervalId) clearInterval(state.pingIntervalId);
        state.pingIntervalId = setInterval(() => {
            if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ action: 'PING', timestamp: Date.now() }));
            }
        }, 2000);
    };

    state.ws.onclose = () => {
        const dot = document.getElementById('connection-dot');
        if (dot) dot.className = 'status-dot';
        
        const txt = document.getElementById('connection-text');
        if (txt) {
            txt.innerText = '연결 끊김';
            txt.style.color = '#ef4444';
        }
        
        if (state.pingIntervalId) {
            clearInterval(state.pingIntervalId);
            state.pingIntervalId = null;
        }
        
        const nextDelay = state.backoffDelay + Math.floor(Math.random() * 1000);
        logEntry('system', `연결 끊김. ${Math.round(nextDelay / 1000)}초 후 재연결 시도.`);
        
        setTimeout(() => {
            if (dot) {
                dot.style.backgroundColor = '#f59e0b';
                dot.style.boxShadow = '0 0 10px #f59e0b';
            }
            if (txt) {
                txt.innerText = '연결 중...';
                txt.style.color = '#f59e0b';
            }
            connect();
        }, nextDelay);
        
        state.backoffDelay = Math.min(30000, state.backoffDelay * 2);
    };

    state.ws.onerror = () => {
        logEntry('system', '웹소켓 통신 에러 발생');
    };

    state.ws.onmessage = (event) => {
        msgCount++;
        const data = event.data;

        // Pong latency checker
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed.action === 'PONG') {
                    const rtt = Date.now() - parsed.timestamp;
                    const latencyDisplay = document.getElementById('latency-display');
                    if (latencyDisplay) latencyDisplay.innerText = `${rtt} ms`;
                }
            } catch (e) {
                // Ignore
            }
            return;
        }

        const buffer = data;
        if (buffer.byteLength !== 32) {
            logEntry('system', `비정상적인 크기의 바이너리 수신: ${buffer.byteLength} 바이트`);
            return;
        }

        // Decode Compact Binary Layout:
        // [SymbolId(4 바이트)][Seq(8 바이트)][Price(8 바이트)][Qty(8 바이트)][Side(4 바이트)]
        const view = new DataView(buffer);
        const symbolId = view.getInt32(0, false);
        const price = view.getBigInt64(12, false);
        const deltaQty = view.getBigInt64(20, false);
        const side = view.getInt32(28, false);

        const priceNum = Number(price);
        const qtyNum = Number(deltaQty);

        let msgSymbol = null;
        if (symbolId === BTC_SYMBOL_ID) {
            msgSymbol = 'BTC-USD';
        } else if (symbolId === ADA_SYMBOL_ID) {
            msgSymbol = 'ADA-KRW';
        } else {
            return; // Ignore unknown symbolId
        }

        const targetBook = books[msgSymbol];

        // Process live executions (qtyNum < 0)
        if (qtyNum < 0) {
            addTradeHistory(msgSymbol, priceNum, Math.abs(qtyNum), side);
        }

        // Set neon flash triggers
        if (msgSymbol === state.currentSymbol) {
            state.priceFlashStates.set(priceNum, qtyNum > 0 ? 'inc' : 'dec');
        }

        // Update local memory order books
        if (side === 0) { // BUY (Bid)
            const current = targetBook.bids.get(priceNum) || 0;
            const next = current + qtyNum;
            if (next <= 0) {
                targetBook.bids.delete(priceNum);
            } else {
                targetBook.bids.set(priceNum, next);
            }
        } else { // SELL (Ask)
            const current = targetBook.asks.get(priceNum) || 0;
            const next = current + qtyNum;
            if (next <= 0) {
                targetBook.asks.delete(priceNum);
            } else {
                targetBook.asks.set(priceNum, next);
            }
        }

        if (msgSymbol === state.currentSymbol) {
            state.needsRender = true;
        }
    };
}

function updateVolumePower(side, qty) {
    state.recentTradesForPower.push({ side, qty, time: Date.now() });
    if (state.recentTradesForPower.length > 200) {
        state.recentTradesForPower.shift();
    }

    let buySum = 0;
    let sellSum = 0;
    state.recentTradesForPower.forEach(t => {
        if (t.side === 1) buySum += t.qty;
        else sellSum += t.qty;
    });

    const power = sellSum > 0 ? (buySum / sellSum) * 100 : 100;
    const powerEl = document.getElementById('vol-power');
    if (powerEl) {
        powerEl.innerText = power.toFixed(1) + '%';
    }
}

export function addTradeHistory(symbol, price, qty, side) {
    if (symbol === state.currentSymbol) {
        updateVolumePower(side, qty);
        state.lastTradePrice = price;
    }
    const targetBook = books[symbol];

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const priceVal = (price / 100).toFixed(2);
    const totalVal = ((price / 100) * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const isBuyExecution = (side === 1);
    const rowClass = isBuyExecution ? 'buy' : 'sell';

    const tradeItem = { timeStr, priceVal, qty, totalVal, rowClass };
    targetBook.tradeHistory.unshift(tradeItem);

    if (targetBook.tradeHistory.length > 50) {
        targetBook.tradeHistory.pop();
    }

    if (symbol === state.currentSymbol) {
        const tbody = document.getElementById('trades-tbody');
        if (tbody) {
            const row = document.createElement('tr');
            row.className = rowClass;
            row.innerHTML = `
                <td class="time-cell">${timeStr}</td>
                <td>${priceVal}</td>
                <td class="qty-cell-history">${qty}</td>
                <td>${totalVal}</td>
            `;
            tbody.insertBefore(row, tbody.firstChild);

            while (tbody.children.length > 50) {
                tbody.removeChild(tbody.lastChild);
            }
        }
    }
}

export function renderTradeHistoryUI() {
    const tbody = document.getElementById('trades-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    const history = books[state.currentSymbol].tradeHistory;
    history.forEach(item => {
        const row = document.createElement('tr');
        row.className = item.rowClass;
        row.innerHTML = `
            <td class="time-cell">${item.timeStr}</td>
            <td>${item.priceVal}</td>
            <td class="qty-cell-history">${item.qty}</td>
            <td>${item.totalVal}</td>
        `;
        tbody.appendChild(row);
    });
}
