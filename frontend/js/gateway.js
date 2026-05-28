// 🌌 초저지연(Low-Latency) 실시간 바이너리 웹소켓 게이트웨이 커넥터 모듈
import { state, books, BTC_SYMBOL_ID, ADA_SYMBOL_ID, logEntry, alertBubble } from './state.js';
import { updateOrderbookUI } from './orderbook.js';
import { addPriceTick } from './chart.js';

// 실시간 처리량(TPS) 측정을 위한 카운터 변수
let msgCount = 0;
let lastSpeedTime = Date.now();

/**
 * 게이트웨이 초기화 함수
 * 1초 주기로 초당 메시지 처리량(TPS)을 측정하고 화면에 표시하는 타이머를 구동.
 */
export function initGateway() {
    // 실시간 초당 처리량(TPS: Transactions Per Second) 계측 타이머
    setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastSpeedTime) / 1000; // 지난 시간 계산 (초 단위)
        const tps = Math.round(msgCount / elapsed); // 초당 메시지 수 계산
        const tpsDisplay = document.getElementById('throughput-display');

        if (tpsDisplay) {
            tpsDisplay.innerText = `${tps} msgs/s`; // UI에 TPS 업데이트
        }

        // 웹소켓 연결이 유효하지 않은 경우, 레이턴시 표시기초기화
        const latencyDisplay = document.getElementById('latency-display');
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
            if (latencyDisplay) latencyDisplay.innerText = `-- ms`;
        }

        // 카운터 및 기준 시간 초기화
        msgCount = 0;
        lastSpeedTime = now;
    }, 1000);

    // 웹소켓 연결 시작
    connect();
}

/**
 * 웹소켓 게이트웨이 실시간 연결 함수
 * Netty 웹소켓 서버에 접속하고 바이너리 패킷 스트림을 처리.
 */
export function connect() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8088/ws`; // Netty 웹소켓 서버 접속 주소

    logEntry('system', `웹소켓 게이트웨이에 연결 중: ${wsUrl}`);
    state.ws = new WebSocket(wsUrl);

    // 고성능 처리를 위해 수신 데이터 타입을 ArrayBuffer(바이너리)로 명시 설정
    state.ws.binaryType = 'arraybuffer';

    // 1. 소켓 커넥션 수립 시 처리 핸들러
    state.ws.onopen = () => {
        // UI 헤더 우측의 연결 LED 도트 상태를 '연결됨(녹색)'으로 업데이트
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
        state.backoffDelay = 1000; // 재연결 지연 초기화

        // 웹소켓 연결 성공 즉시 최신 오더북 Full Snapshot 강제 동기화 수행
        fetchSnapshot('BTC-USD');
        fetchSnapshot('ADA-KRW');

        // 2초 간격으로 서버에 PING을 발송하여 종단간 RTT(네트워크 지연) 계측 시작
        if (state.pingIntervalId) clearInterval(state.pingIntervalId);
        state.pingIntervalId = setInterval(() => {
            if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ action: 'PING', timestamp: Date.now() }));
            }
        }, 2000);
    };

    // 2. 소켓 커넥션 종료 시 처리 핸들러 (지수 백오프 기반 재연결 포함)
    state.ws.onclose = () => {
        // UI 연결 LED 도트 상태를 '연결 끊김(적색)'으로 업데이트
        const dot = document.getElementById('connection-dot');
        if (dot) dot.className = 'status-dot';

        const txt = document.getElementById('connection-text');
        if (txt) {
            txt.innerText = '연결 끊김';
            txt.style.color = '#ef4444';
        }

        // PING 주기 발송 타이머 중지
        if (state.pingIntervalId) {
            clearInterval(state.pingIntervalId);
            state.pingIntervalId = null;
        }

        // 지수 백오프(Exponential Backoff) 기반 재연결 스케줄러 기동
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
            connect(); // 재연결 실행
        }, nextDelay);

        // 최대 재연결 대기 시간은 30초로 제한
        state.backoffDelay = Math.min(30000, state.backoffDelay * 2);
    };

    // 3. 소켓 통신 에러 발생 시 핸들러
    state.ws.onerror = () => {
        logEntry('system', '웹소켓 통신 에러 발생');
    };

    // 4. 실시간 웹소켓 메시지 수신 이벤트 핸들러
    state.ws.onmessage = (event) => {
        msgCount++; // 초당 TPS 계산용 카운트 증가
        const data = event.data;

        // A. 텍스트 프레임(String) 메시지 처리 (주로 PING-PONG 응답 수신)
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                if (parsed.action === 'PONG') {
                    // PONG 수신 시 보냈던 타임스탬프와 현재 시간을 대조하여 RTT(네트워크 지연시간) 계산
                    const rtt = Date.now() - parsed.timestamp;
                    const latencyDisplay = document.getElementById('latency-display');
                    if (latencyDisplay) latencyDisplay.innerText = `${rtt} ms`;
                }
            } catch (e) {
                // 파싱 오류 예외 처리 무시
            }
            return;
        }

        // B. 바이너리 프레임(ArrayBuffer) 메시지 처리 (실시간 호가 정보 수신)
        const buffer = data;

        // 정상적인 바이너리 패킷은 항상 정확히 32바이트 크기여야 함
        if (buffer.byteLength !== 32) {
            logEntry('system', `비정상적인 크기의 바이너리 수신: ${buffer.byteLength} 바이트`);
            return;
        }

        /**
         * [ Netty 게이트웨이 송출용 초경량 바이너리 인코딩 레이아웃 ]
         * 32바이트 구조체 구조 (Big-Endian 데이터 뷰 해독):
         * 
         * 1. [0 ~ 3 바이트]  - SymbolId (4바이트 정수: BTC-USD 또는 ADA-KRW 고유 해시코드)
         * 2. [4 ~ 11 바이트] - Seq (8바이트 롱타입 정수: 호가 이벤트 시퀀스 일련번호)
         * 3. [12 ~ 19 바이트] - Price (8바이트 롱타입 정수: x100 스케일링된 호가 가격)
         * 4. [20 ~ 27 바이트] - Qty (8바이트 롱타입 정수: 변동 수량. 양수는 호가 잔량 가산, 음수는 체결 발생)
         * 5. [28 ~ 31 바이트] - Side (4바이트 정수: 0은 매수/BUY 호가, 1은 매도/SELL 호가)
         */
        const view = new DataView(buffer);
        const symbolId = view.getInt32(0, false); // false = Big Endian 방식으로 정수 디코딩
        const price = view.getBigInt64(12, false);
        const deltaQty = view.getBigInt64(20, false);
        const side = view.getInt32(28, false);

        // 자바스크립트 수치 계산을 위해 BigInt(long) 값을 표준 Number 타입으로 치환
        const priceNum = Number(price);
        const qtyNum = Number(deltaQty);

        // 32바이트 패킷의 SymbolId 해시코드를 매칭 테이블과 대조하여 마켓 식별
        let msgSymbol = null;
        if (symbolId === BTC_SYMBOL_ID) {
            msgSymbol = 'BTC-USD';
        } else if (symbolId === ADA_SYMBOL_ID) {
            msgSymbol = 'ADA-KRW';
        } else {
            return; // 미등록된 알 수 없는 마켓 심볼 ID 패킷 수신 시 무시 처리
        }

        const targetBook = books[msgSymbol];

        // 5. 수량변동값(qtyNum)이 음수(< 0)이면 호가 잔량 소멸이 아닌, 실제 거래 체결 발생을 의미!
        if (qtyNum < 0) {
            addTradeHistory(msgSymbol, priceNum, Math.abs(qtyNum), side);
        }

        // 6. 실시간 깜빡임 시각 효과(Neon Flash CSS) 타겟 상태 기록
        if (msgSymbol === state.currentSymbol) {
            state.priceFlashStates.set(priceNum, qtyNum > 0 ? 'inc' : 'dec');
        }

        // 7. 실시간 인메모리 호가 장부(Order Book)의 Bids/Asks 맵 잔량 업데이트
        if (side === 0) { // BUY (Bid - 매수 호가창)
            const current = targetBook.bids.get(priceNum) || 0;
            const next = current + qtyNum;
            if (next <= 0) {
                targetBook.bids.delete(priceNum); // 수량이 0 이하가 되면 호가 라인 완전 소멸
            } else {
                targetBook.bids.set(priceNum, next); // 잔량 가산/감산 반영
            }
        } else { // SELL (Ask - 매도 호가창)
            const current = targetBook.asks.get(priceNum) || 0;
            const next = current + qtyNum;
            if (next <= 0) {
                targetBook.asks.delete(priceNum);
            } else {
                targetBook.asks.set(priceNum, next);
            }
        }

        // 수신된 패킷이 현재 화면에 띄워진 종목의 것일 때만 60Hz 화면 렌더 플래그 가동
        if (msgSymbol === state.currentSymbol) {
            state.needsRender = true;
        }
    };
}

/**
 * 실시간 체결 강도(Volume Power) 계산 함수
 * 최근 200건의 체결 이력을 분석하여 매수 강도를 백분율(%)로 산출합니다.
 */
function updateVolumePower(side, qty) {
    state.recentTradesForPower.push({ side, qty, time: Date.now() });

    // 분석 대상은 최근 200건으로 슬라이딩 윈도우 유지
    if (state.recentTradesForPower.length > 200) {
        state.recentTradesForPower.shift();
    }

    let buySum = 0;
    let sellSum = 0;
    state.recentTradesForPower.forEach(t => {
        if (t.side === 1) buySum += t.qty; // 매수 체결 합산
        else sellSum += t.qty;             // 매도 체결 합산
    });

    const power = sellSum > 0 ? (buySum / sellSum) * 100 : 100;
    const powerEl = document.getElementById('vol-power');
    if (powerEl) {
        powerEl.innerText = power.toFixed(1) + '%'; // 화면 출력
    }
}

/**
 * 체결 이력 메모리 및 테이블 DOM 실시간 업데이트 함수
 */
export function addTradeHistory(symbol, price, qty, side) {
    // 현재 보고 있는 종목의 체결일 때만 시각 효과 및 변동 지표 업데이트
    if (symbol === state.currentSymbol) {
        updateVolumePower(side, qty);
        state.lastTradePrice = price; // 최종 체결가 보정
        addPriceTick(price / 100);    // 실시간 캔들 차트 업데이트!
    }
    const targetBook = books[symbol];

    // 시간 포맷팅 (시:분:초.밀리초)
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    // 가격 스케일 복원 (서버의 x100 정수를 소수 두 자리 실수 형태로 복원)
    const priceVal = (price / 100).toFixed(2);
    // 총 체결 금액 가시화 계산
    const totalVal = ((price / 100) * qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 매수 체결인지 매도 체결인지 파악하여 글자색 CSS 다변화
    const isBuyExecution = (side === 1);
    const rowClass = isBuyExecution ? 'buy' : 'sell';

    const tradeItem = { timeStr, priceVal, qty, totalVal, rowClass };
    targetBook.tradeHistory.unshift(tradeItem); // 메모리 배열 처음에 신규 체결 삽입

    // 체결 기록 오버헤드 억제를 위해 최대 50건으로 제한
    if (targetBook.tradeHistory.length > 50) {
        targetBook.tradeHistory.pop();
    }

    // 현재 보고 있는 심볼의 체결 내역 테이블 DOM 실시간 드로잉
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
            tbody.insertBefore(row, tbody.firstChild); // 첫 행 자리에 실시간 삽입

            // 스크롤 성능 유지를 위해 최대 DOM 엘리먼트 갯수 50개 유지
            while (tbody.children.length > 50) {
                tbody.removeChild(tbody.lastChild);
            }
        }
    }
}

/**
 * 종목 간 화면 전환 시 전체 체결 이력 테이블 재렌더링 함수
 */
export function renderTradeHistoryUI() {
    const tbody = document.getElementById('trades-tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // 테이블 내용 전체 비우기

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
        tbody.appendChild(row); // 순차적 누적 삽입
    });
}

/**
 * REST API를 사용하여 특정 심볼의 Full Orderbook Snapshot을 동기적으로 가져와 로컬 장부를 초기화함
 */
export async function fetchSnapshot(symbol) {
    const host = window.location.hostname || 'localhost';
    const port = symbol === 'BTC-USD' ? 9100 : 9101;
    const url = `http://${host}:${port}/snapshot`;

    logEntry('system', `${symbol} Full Snapshot 동기화 시작...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const targetBook = books[symbol];
        if (targetBook) {
            targetBook.bids.clear();
            targetBook.asks.clear();

            if (data.bids) {
                for (const [price, qty] of data.bids) {
                    targetBook.bids.set(price, qty);
                }
            }
            if (data.asks) {
                for (const [price, qty] of data.asks) {
                    targetBook.asks.set(price, qty);
                }
            }

            logEntry('system', `${symbol} Full Snapshot 동기화 완료 (Seq: ${data.seq}, 매수: ${data.bids ? data.bids.length : 0}건, 매도: ${data.asks ? data.asks.length : 0}건)`);
            
            if (symbol === state.currentSymbol) {
                state.needsRender = true;
            }
        }
    } catch (error) {
        logEntry('warning', `${symbol} Snapshot 동기화 실패: ${error.message}`);
    }
}
