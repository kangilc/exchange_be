// 🌌 Canvas price history graphing module
import { state, books } from './state.js';

let chartCanvas = null;
let chartCtx = null;
const maxHistoryPoints = 65;

export function initChart() {
    chartCanvas = document.getElementById('priceCanvas');
    if (!chartCanvas) return;
    
    chartCtx = chartCanvas.getContext('2d');

    // Resize handlers
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 300);
}

export function resizeCanvas() {
    if (!chartCanvas) return;
    const rect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = rect.width * window.devicePixelRatio;
    chartCanvas.height = rect.height * window.devicePixelRatio;
    chartCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawPriceChart();
}

export function addPriceTick(price) {
    const book = books[state.currentSymbol];
    if (!book) return;
    
    const history = book.priceHistory;
    const last = history[history.length - 1];
    if (last === price) return;
    
    history.push(price);
    if (history.length > maxHistoryPoints) {
        history.shift();
    }
    drawPriceChart();
}

export function drawPriceChart() {
    if (!chartCanvas || !chartCtx) return;
    
    const w = chartCanvas.width / window.devicePixelRatio;
    const h = chartCanvas.height / window.devicePixelRatio;

    chartCtx.clearRect(0, 0, w, h);

    const book = books[state.currentSymbol];
    if (!book) return;

    const history = book.priceHistory;

    if (history.length === 0) {
        chartCtx.fillStyle = '#94a3b8';
        chartCtx.font = '13px Noto Sans KR';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('엔진으로부터 실시간 호가 데이터를 수신 대기 중...', w / 2, h / 2);
        return;
    }

    // Calc boundaries
    let maxPrice = -Infinity;
    let minPrice = Infinity;
    history.forEach(p => {
        if (p > maxPrice) maxPrice = p;
        if (p < minPrice) minPrice = p;
    });

    const range = maxPrice - minPrice || 10;
    const paddedMin = minPrice - (range * 0.15);
    const paddedMax = maxPrice + (range * 0.15);
    const rangeScale = paddedMax - paddedMin;

    function getX(index) {
        return (index / (maxHistoryPoints - 1)) * (w - 20) + 10;
    }

    function getY(val) {
        return h - ((val - paddedMin) / rangeScale) * (h - 40) - 20;
    }

    // Grid lines
    chartCtx.beginPath();
    chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    chartCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const yGrid = (h / 4) * i;
        chartCtx.moveTo(0, yGrid);
        chartCtx.lineTo(w, yGrid);
    }
    chartCtx.stroke();

    // 1. Chart area fill gradient
    chartCtx.beginPath();
    chartCtx.moveTo(getX(0), h);
    history.forEach((pt, i) => {
        chartCtx.lineTo(getX(i), getY(pt));
    });
    chartCtx.lineTo(getX(history.length - 1), h);
    chartCtx.closePath();

    const areaGrd = chartCtx.createLinearGradient(0, 0, 0, h);
    areaGrd.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
    areaGrd.addColorStop(1, 'rgba(138, 43, 226, 0.0)');
    chartCtx.fillStyle = areaGrd;
    chartCtx.fill();

    // 2. Stroke line
    chartCtx.beginPath();
    history.forEach((pt, i) => {
        if (i === 0) chartCtx.moveTo(getX(i), getY(pt));
        else chartCtx.lineTo(getX(i), getY(pt));
    });
    const lineGrd = chartCtx.createLinearGradient(0, 0, w, 0);
    lineGrd.addColorStop(0, '#8a2be2');
    lineGrd.addColorStop(1, '#00f2fe');
    chartCtx.strokeStyle = lineGrd;
    chartCtx.lineWidth = 2.5;
    chartCtx.shadowColor = 'rgba(0, 242, 254, 0.4)';
    chartCtx.shadowBlur = 8;
    chartCtx.stroke();
    chartCtx.shadowBlur = 0; // Reset

    // 3. Last price blinking dot
    const lastIdx = history.length - 1;
    const lastPrice = history[lastIdx];
    const px = getX(lastIdx);
    const py = getY(lastPrice);

    chartCtx.beginPath();
    chartCtx.arc(px, py, 6, 0, 2 * Math.PI);
    chartCtx.fillStyle = '#00f2fe';
    chartCtx.fill();

    chartCtx.beginPath();
    chartCtx.arc(px, py, 12, 0, 2 * Math.PI);
    chartCtx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    chartCtx.lineWidth = 2;
    chartCtx.stroke();

    // 4. Floating Price Tag
    chartCtx.fillStyle = '#fff';
    chartCtx.font = 'bold 11px Fira Code';
    chartCtx.textAlign = 'left';
    const unit = state.currentSymbol === 'BTC-USD' ? '$' : '₩';
    chartCtx.fillText(`${unit}${lastPrice.toFixed(2)}`, px - 75, py - 12);
}
