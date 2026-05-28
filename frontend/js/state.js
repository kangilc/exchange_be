// 🌌 실시간 거래소 포털 글로벌 상태 관리 모듈
// 회원 지갑의 초기 자산 잔고 기본값 정의
export const defaultBalances = {
    KRW: 1000000000, // 10억 원
    USD: 10000,      // 1만 달러
    BTC: 10.0,       // 10 BTC
    ADA: 100000.0    // 10만 ADA
};

// 애플리케이션의 핵심 라이브 데이터를 보유하는 싱글톤 전역 상태 객체
export const state = {
    ws: null,               // 게이트웨이 웹소켓 커넥션 객체
    selectedSide: 'BUY',    // 현재 선택된 주문 방향 ('BUY' 또는 'SELL')
    currentSymbol: 'BTC-USD', // 현재 활성화된 마켓 심볼
    backoffDelay: 1000,     // 웹소켓 끊김 시 지수 백오프 재연결 초기 대기 지연(ms)
    pingIntervalId: null,   // RTT 측정을 위한 PING 타이머 ID
    needsRender: false,     // 오더북 화면 렌더링(RequestAnimationFrame) 필요 여부 플래그
    lastTradePrice: 6500000, // 가장 최근에 체결된 최종 가격 (x100 스케일링 상태)
    
    // 로컬스토리지에서 기존 잔고를 읽어오며, 데이터가 없을 경우 기본 샌드박스 잔고로 초기화
    balances: JSON.parse(localStorage.getItem('hfx_balances')) || { ...defaultBalances },
    
    // 로컬스토리지에서 기존 포트폴리오 정보를 읽어오거나 기본 모의 매수 평단가로 세팅
    myPortfolio: JSON.parse(localStorage.getItem('hfx_portfolio')) || {
        'BTC-USD': { qty: 10.0, avgPrice: 65000 },
        'ADA-KRW': { qty: 100000.0, avgPrice: 500 }
    },
    
    recentTradesForPower: [], // 체결강도 산출을 위해 최근 체결 이력을 담아두는 슬라이딩 윈도우 배열
    activeGroupingFactor: 1,  // 호가창 가격 병합 필터링 수치 (1, 10, 100)
    priceFlashStates: new Map(), // 호가 잔량 변동 시 깜빡임 CSS 클래스를 주기 위한 임시 메모리 맵
    
    // 2FA 보안 상태
    is2FAVerified: false,            // 2FA OTP 보안 인증 성공 여부 플래그
    otpSecret: "J4V4FX2FASECUREKEY", // 구글 OTP 시뮬레이션용 대칭 비밀키
    
    // 대기 중인 예약 주문(Stop-Limit) 리스트 (로컬스토리지 동기화)
    stopLimitOrders: JSON.parse(localStorage.getItem('hfx_stop_limit_orders')) || [],
    
    // 입출금 감사 로그 리스트 (로컬스토리지 동기화)
    ledger: JSON.parse(localStorage.getItem('hfx_ledger')) || [],

    // 현재 활성화된 데이터 서비스 모드 (false = 모의투자/Sandbox, true = 실거래/Live DB)
    isLive: JSON.parse(localStorage.getItem('hfx_is_live')) || false,
};

/**
 * 자바의 String.hashCode() 알고리즘을 자바스크립트로 구현한 함수
 * 백엔드 매칭 엔진 및 게이트웨이에서 사용하는 32비트 정수형 심볼 ID 해시와 100% 매칭됨
 */
export function getHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char; // hash * 31 + char 와 동일한 비트 연산
        hash |= 0; // 32비트 부호 있는 정수형(signed 32bit int)으로 변환 강제
    }
    return Math.abs(hash); // 최종 정수의 절대값 반환
}

// 성능 향상을 위해 렌더링에 앞서 마켓 심볼의 고유 정수 해시코드를 사전 계산 및 상수로 캐싱
export const BTC_SYMBOL_ID = getHashCode("BTC-USD");
export const ADA_SYMBOL_ID = getHashCode("ADA-KRW");

// 심볼별 인메모리 호가 장부(Order Book) 및 체결 히스토리 기본 프레임워크 초기화
export const books = {
    'BTC-USD': {
        bids: new Map(), // 매수 대기 주문 맵
        asks: new Map(), // 매도 대기 주문 맵
        basePrice: 65000, // 전일 대비 등락률 산출용 기준가 (65,000.00 달러)
        lastRenderedAsks: new Array(10).fill(null), // 이전 프레임의 매도 드로잉 상태 캐시
        lastRenderedBids: new Array(10).fill(null), // 이전 프레임의 매수 드로잉 상태 캐시
        priceHistory: [], // 차트 드로잉용 역사 가격 배열
        tradeHistory: []  // 체결 내역 리스트 이력
    },
    'ADA-KRW': {
        bids: new Map(),
        asks: new Map(),
        basePrice: 500,  // 전일 대비 등락률 산출용 기준가 (500.00 원)
        lastRenderedAsks: new Array(10).fill(null),
        lastRenderedBids: new Array(10).fill(null),
        priceHistory: [],
        tradeHistory: []
    }
};

/**
 * 지갑 자산 원장 상태를 브라우저 로컬스토리지에 물리적으로 직렬화하여 영구 세이브
 * 변경 사항이 반영되면 'walletUpdated' 커스텀 이벤트를 방송하여 화면단 재렌더링 트리거
 */
export function saveWallet() {
    localStorage.setItem('hfx_balances', JSON.stringify(state.balances));
    localStorage.setItem('hfx_portfolio', JSON.stringify(state.myPortfolio));
    localStorage.setItem('hfx_stop_limit_orders', JSON.stringify(state.stopLimitOrders));
    localStorage.setItem('hfx_ledger', JSON.stringify(state.ledger));
    localStorage.setItem('hfx_is_live', JSON.stringify(state.isLive));
    
    // 지갑 상태 업데이트 이벤트를 뷰포트에 통지
    window.dispatchEvent(new CustomEvent('walletUpdated'));
}

/**
 * 가상 지갑의 모든 자산과 거래 내역, 예약 주문, 2FA 상태를 초기의 순수 디폴트 상태로 초기화
 */
export function resetWallet() {
    state.balances = { ...defaultBalances };
    state.myPortfolio = {
        'BTC-USD': { qty: 10.0, avgPrice: 65000 },
        'ADA-KRW': { qty: 100000.0, avgPrice: 500 }
    };
    state.stopLimitOrders = [];
    state.ledger = [];
    state.is2FAVerified = false;
    saveWallet(); // 리셋된 정보 즉시 저장 및 화면 반영
}

/**
 * 대시보드 우측 최하단 '실시간 매칭 로그 콘솔' 뷰포트에 실시간 감사 이력 로그를 삽입하는 헬퍼 함수
 */
export function logEntry(tag, message) {
    const logsContainer = document.getElementById('event-logs');
    if (!logsContainer) return;
    
    const timeStr = new Date().toLocaleTimeString(); // 현재 지역 시간 포맷 생성
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    // 태그 식별을 위한 한글화 바인딩
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

    // 최신 로그를 상단에 밀어넣기 형태로 삽입
    logsContainer.insertBefore(entry, logsContainer.firstChild);

    // 로그 엘리먼트 갯수가 50개를 초과할 시 과도한 메모리 점유 방지를 위해 최하단 이력 제거
    if (logsContainer.children.length > 50) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

/**
 * 우측 상단 또는 화면 중심 영역에 프리미엄 플로팅 알림창(Toast Alert Bubble)을 띄우는 함수
 * 2.5초간 가시화된 후 위쪽으로 부드럽게 페이드아웃 애니메이션을 주며 완전 제거 처리
 */
export function alertBubble(msg, bgColor) {
    const bubble = document.createElement('div');
    bubble.className = 'alert-bubble';
    if (bgColor) bubble.style.background = bgColor; // 오류 시 붉은색, 성공 시 에메랄드색 등 동적 색상 매핑
    bubble.innerText = msg;

    document.body.appendChild(bubble); // 문서 바디 끝에 동적 추가
    setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translateY(-20px)';
        setTimeout(() => bubble.remove(), 400); // 400ms 페이드아웃 효과 진행 후 DOM 완전 소멸
    }, 2500);
}
