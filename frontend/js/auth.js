// 🌌 2FA Security OTP Module
import { state, logEntry, alertBubble } from './state.js';

let otpTimerId = null;
let currentOtpCode = "";

// Generate a 6-digit simulated OTP that changes every 30 seconds
function generateSimulatedOTP() {
    const epoch = Math.floor(Date.now() / 30000);
    // Simple deterministic hash based on epoch and secret
    const val = (epoch * 31 + 12345) % 1000000;
    return String(val).padStart(6, '0');
}

export function initAuth() {
    // Inject HTML for 2FA verification modal if not present
    if (!document.getElementById('auth-modal')) {
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box security-modal">
                <div class="modal-header-box">
                    <h3>🌌 2FA OTP 보안 인증</h3>
                    <button class="modal-close-btn" id="auth-modal-close">&times;</button>
                </div>
                <div class="modal-body-box">
                    <div class="otp-qr-container">
                        <div class="mock-qr">
                            <div class="qr-line"></div>
                            <span class="qr-text">OTP QR CODE</span>
                        </div>
                        <div class="otp-key-info">
                            <span class="info-label">Simulated Key</span>
                            <span class="info-value">J4VA FX2F ASEC</span>
                        </div>
                    </div>
                    
                    <p class="modal-desc">안전한 자산 보호를 위해 구글 OTP(Google Authenticator) 앱에 등록된 6자리 번호를 입력해주세요.</p>
                    
                    <div class="otp-countdown-container">
                        <span class="countdown-label">시뮬레이션 남은 시간:</span>
                        <span id="otp-timer" class="countdown-value">30초</span>
                    </div>

                    <div class="otp-input-row">
                        <input type="text" id="otp-code-input" maxlength="6" placeholder="0 0 0 0 0 0" autocomplete="off" class="otp-input">
                    </div>

                    <div class="simulated-otp-hint">
                        💡 시뮬레이터 실시간 OTP 힌트: <span id="realtime-otp-hint" class="hint-code">------</span>
                    </div>
                    
                    <button id="auth-verify-btn" class="btn-primary-glow">보안 인증 완료</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add events
        document.getElementById('auth-modal-close').onclick = closeAuthModal;
        document.getElementById('auth-verify-btn').onclick = verifyOTP;
        document.getElementById('otp-code-input').onkeyup = (e) => {
            if (e.key === 'Enter') verifyOTP();
        };
    }
}

export function showAuthModal(successCallback) {
    initAuth();
    const modal = document.getElementById('auth-modal');
    modal.classList.add('active');
    document.getElementById('otp-code-input').value = "";
    document.getElementById('otp-code-input').focus();
    
    // Start simulated OTP generation and countdown
    updateOTPPair();
    if (otpTimerId) clearInterval(otpTimerId);
    
    otpTimerId = setInterval(() => {
        const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
        document.getElementById('otp-timer').innerText = `${remaining}초`;
        if (remaining === 30 || currentOtpCode === "") {
            updateOTPPair();
        }
    }, 1000);
    
    // Attach callback to verify button
    document.getElementById('auth-verify-btn').onclick = () => {
        verifyOTP(successCallback);
    };
}

function updateOTPPair() {
    currentOtpCode = generateSimulatedOTP();
    const hintEl = document.getElementById('realtime-otp-hint');
    if (hintEl) hintEl.innerText = currentOtpCode;
}

export function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    if (otpTimerId) {
        clearInterval(otpTimerId);
        otpTimerId = null;
    }
}

function verifyOTP(successCallback) {
    const input = document.getElementById('otp-code-input').value.trim();
    if (input === currentOtpCode || input === "777777") { // Master back-door for debugging
        state.is2FAVerified = true;
        alertBubble("보안 2FA 인증에 성공하였습니다!", "rgba(16, 185, 129, 0.95)");
        logEntry("auth", "2FA OTP 보안인증을 성공적으로 마쳤습니다.");
        closeAuthModal();
        if (successCallback) successCallback();
    } else {
        alertBubble("인증 코드가 일치하지 않습니다. 다시 입력해주세요.", "rgba(239, 68, 68, 0.95)");
        logEntry("warning", "OTP 인증 번호 입력 실패 (비인가 접근 경고)");
    }
}

// Log in mock device tracker
export function logDeviceSession() {
    const userAgent = navigator.userAgent;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    const deviceType = isMobile ? "Mobile Device" : "Desktop (Linux Webkit)";
    const ipMock = "192.168.1." + Math.floor(Math.random() * 254 + 1);
    
    logEntry("auth", `보안 세션 수립: 기기 [${deviceType}] IP [${ipMock}]가 접속을 개시하였습니다.`);
}
