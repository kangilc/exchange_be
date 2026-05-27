// 🌌 Smart Wallet and Deposit/Withdrawal Control Module
import { state, saveWallet, logEntry, alertBubble, books } from './state.js';
import { showAuthModal } from './auth.js';
import { getActiveWalletService } from './walletService.js';

export function initWallet() {
    // Inject Deposit & Withdrawal Modal
    if (!document.getElementById('wallet-modal')) {
        const modal = document.createElement('div');
        modal.id = 'wallet-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box wallet-control-modal">
                <div class="modal-header-box">
                    <h3>🌌 자산 입출금 제어판</h3>
                    <button class="modal-close-btn" id="wallet-modal-close">&times;</button>
                </div>
                <div class="modal-body-box">
                    <div class="wallet-tabs">
                        <button id="wallet-tab-deposit" class="wallet-tab-btn active">입금 (Deposit)</button>
                        <button id="wallet-tab-withdraw" class="wallet-tab-btn">출금 (Withdrawal)</button>
                    </div>

                    <!-- Deposit Tab Contents -->
                    <div id="deposit-section" class="wallet-content-section active">
                        <div class="input-group">
                            <label class="input-label">입금할 자산 선택</label>
                            <select id="deposit-asset-select" class="form-select">
                                <option value="KRW">대한민국 원화 (KRW)</option>
                                <option value="USD">미국 달러 (USD)</option>
                                <option value="BTC">비트코인 (BTC)</option>
                                <option value="ADA">에이다 (ADA)</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin-top: 1rem;">
                            <label class="input-label">입금액 / 수량</label>
                            <div class="input-wrapper">
                                <input type="number" id="deposit-amount" placeholder="금액을 입력하세요" min="0.00000001" step="any">
                            </div>
                        </div>
                        <button id="execute-deposit-btn" class="btn-primary-glow" style="margin-top: 1.5rem; background: linear-gradient(135deg, #10b981, #059669);">
                            즉시 입금 승인
                        </button>
                    </div>

                    <!-- Withdrawal Tab Contents -->
                    <div id="withdraw-section" class="wallet-content-section">
                        <div class="input-group">
                            <label class="input-label">출금할 자산 선택</label>
                            <select id="withdraw-asset-select" class="form-select">
                                <option value="KRW">대한민국 원화 (KRW)</option>
                                <option value="USD">미국 달러 (USD)</option>
                                <option value="BTC">비트코인 (BTC)</option>
                                <option value="ADA">에이다 (ADA)</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin-top: 1rem;">
                            <label class="input-label">출금 주소 (화이트리스트 암호키)</label>
                            <input type="text" id="withdraw-address" class="form-input" placeholder="0x... 또는 은행 계좌 정보">
                        </div>
                        <div class="input-group" style="margin-top: 1rem;">
                            <label class="input-label">출금액 / 수량</label>
                            <div class="input-wrapper">
                                <input type="number" id="withdraw-amount" placeholder="수량을 입력하세요" min="0.00000001" step="any">
                            </div>
                        </div>
                        
                        <div class="security-warning-box">
                            ⚠️ 2FA OTP 보안이 필수로 수행되며 화이트리스트 검증 단계를 경유합니다.
                        </div>

                        <button id="execute-withdraw-btn" class="btn-primary-glow" style="margin-top: 1rem; background: linear-gradient(135deg, #ef4444, #dc2626);">
                            안전 출금 신청
                        </button>
                    </div>

                    <!-- Ledger History Section -->
                    <div class="ledger-history-box" style="margin-top: 1.5rem;">
                        <h4 style="font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem; margin-bottom: 0.5rem; color: #94a3b8;">
                            최근 입출금 내역
                        </h4>
                        <div id="ledger-history-rows" class="ledger-history-rows">
                            <!-- Injected rows -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Bind events
        document.getElementById('wallet-modal-close').onclick = closeWalletModal;
        document.getElementById('wallet-tab-deposit').onclick = () => switchWalletTab('deposit');
        document.getElementById('wallet-tab-withdraw').onclick = () => switchWalletTab('withdraw');
        document.getElementById('execute-deposit-btn').onclick = handleDeposit;
        document.getElementById('execute-withdraw-btn').onclick = handleWithdraw;
    }

    // Inject Portfolio Reports Modal
    if (!document.getElementById('report-modal')) {
        const modal = document.createElement('div');
        modal.id = 'report-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box report-modal">
                <div class="modal-header-box">
                    <h3>📊 종합 자산 및 포트폴리오 분석 리포트</h3>
                    <button class="modal-close-btn" id="report-modal-close">&times;</button>
                </div>
                <div class="modal-body-box">
                    <div class="report-stats-grid">
                        <div class="report-stat-card">
                            <span class="card-title">누적 수수료 등급</span>
                            <span class="card-val" id="report-tier">VIP GOLD (0.015%)</span>
                        </div>
                        <div class="report-stat-card">
                            <span class="card-title">포트폴리오 수익률</span>
                            <span class="card-val text-red" id="report-yield">+12.45%</span>
                        </div>
                        <div class="report-stat-card">
                            <span class="card-title">24H 수수료 기여</span>
                            <span class="card-val" id="report-fees">$125.40</span>
                        </div>
                    </div>

                    <div class="report-chart-container">
                        <h4 style="font-size:0.85rem; margin-bottom:0.75rem; color:#94a3b8;">자산 총가치 최근 추이 (ApexCharts)</h4>
                        <div id="apex-roi-chart" style="width:100%; height:250px;"></div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem;">
                        <button id="report-reset-wallet-btn" class="btn-preset-danger">지갑 완전 초기화</button>
                        <button id="report-close-btn" class="btn-primary-glow" style="width:100px; margin-top:0;">닫기</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('report-modal-close').onclick = closeReportModal;
        document.getElementById('report-close-btn').onclick = closeReportModal;
        document.getElementById('report-reset-wallet-btn').onclick = () => {
            if (confirm("정말로 모든 가상 보유 자산과 주문, 입출금 이력을 초기화하겠습니까?")) {
                resetWallet();
                alertBubble("지갑이 완전 초기화되었습니다.");
                closeReportModal();
                updateWalletUI();
            }
        };
    }

    // Add triggers to main UI buttons if they exist
    const depositBtn = document.getElementById('btn-show-deposit');
    if (depositBtn) {
        depositBtn.onclick = (e) => {
            e.stopPropagation();
            showWalletModal('deposit');
        };
    }

    const withdrawBtn = document.getElementById('btn-show-withdraw');
    if (withdrawBtn) {
        withdrawBtn.onclick = (e) => {
            e.stopPropagation();
            showWalletModal('withdraw');
        };
    }

    const reportTrigger = document.getElementById('portfolio-card');
    if (reportTrigger) {
        reportTrigger.style.cursor = 'pointer';
        reportTrigger.onclick = showReportModal;
    }

    // Sync UI updates
    window.addEventListener('walletUpdated', updateWalletUI);
    updateWalletUI();
}

export function showWalletModal(tab = 'deposit') {
    const modal = document.getElementById('wallet-modal');
    if (modal) {
        modal.classList.add('active');
        switchWalletTab(tab);
        renderLedgerHistory();
    }
}

export function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (modal) modal.classList.remove('active');
}

function switchWalletTab(tab) {
    const depBtn = document.getElementById('wallet-tab-deposit');
    const withBtn = document.getElementById('wallet-tab-withdraw');
    const depSection = document.getElementById('deposit-section');
    const withSection = document.getElementById('withdraw-section');

    if (tab === 'deposit') {
        depBtn.classList.add('active');
        withBtn.classList.remove('active');
        depSection.classList.add('active');
        withSection.classList.remove('active');
    } else {
        depBtn.classList.remove('active');
        withBtn.classList.add('active');
        depSection.classList.remove('active');
        withSection.classList.add('active');
    }
}

async function handleDeposit() {
    const asset = document.getElementById('deposit-asset-select').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);

    if (isNaN(amount) || amount <= 0) {
        alertBubble("올바른 입금액을 입력하세요.", "rgba(239, 68, 68, 0.95)");
        return;
    }

    try {
        const service = getActiveWalletService();
        const log = await service.deposit(asset, amount);
        alertBubble(`${amount} ${asset} 입금이 완료되었습니다.`, "rgba(16, 185, 129, 0.95)");
        logEntry("wallet", `자산 입금 완료: ${amount.toLocaleString()} ${asset} (${log.txId})`);
        
        document.getElementById('deposit-amount').value = "";
        await updateWalletUI();
        renderLedgerHistory();
    } catch (e) {
        alertBubble("입금 처리 중 오류가 발생했습니다.", "rgba(239, 68, 68, 0.95)");
    }
}

async function handleWithdraw() {
    const asset = document.getElementById('withdraw-asset-select').value;
    const address = document.getElementById('withdraw-address').value.trim();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);

    if (!address) {
        alertBubble("출금 주소 정보를 기입하십시오.", "rgba(239, 68, 68, 0.95)");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        alertBubble("올바른 출금 수량을 작성하십시오.", "rgba(239, 68, 68, 0.95)");
        return;
    }
    
    const service = getActiveWalletService();
    const balances = await service.getBalances();
    if ((balances[asset] || 0) < amount) {
        alertBubble("자산이 부족하여 출금할 수 없습니다.", "rgba(239, 68, 68, 0.95)");
        return;
    }

    // Safe withdrawal demands 2FA verification!
    showAuthModal(async () => {
        try {
            const log = await service.withdraw(asset, amount, address);
            alertBubble(`${amount} ${asset} 출금이 보안 승인 완료되었습니다.`, "rgba(16, 185, 129, 0.95)");
            logEntry("wallet", `자산 출금 완료: ${amount.toLocaleString()} ${asset} 주소 [${address.slice(0, 8)}...]`);
            
            document.getElementById('withdraw-amount').value = "";
            document.getElementById('withdraw-address').value = "";
            closeWalletModal();
            await updateWalletUI();
            renderLedgerHistory();
        } catch (e) {
            alertBubble("출금 처리 중 오류가 발생했습니다.", "rgba(239, 68, 68, 0.95)");
        }
    });
}

function renderLedgerHistory() {
    const container = document.getElementById('ledger-history-rows');
    if (!container) return;

    if (state.ledger.length === 0) {
        container.innerHTML = `<div class="ledger-empty">최근 입출금 트랜잭션 기록이 없습니다.</div>`;
        return;
    }

    container.innerHTML = state.ledger.slice(0, 5).map(log => {
        const isDep = log.type === '입금';
        const colorClass = isDep ? 'text-green' : 'text-blue';
        return `
            <div class="ledger-row-item">
                <span class="ledger-type ${colorClass}">${log.type}</span>
                <span class="ledger-val">${log.amount.toLocaleString(undefined, {maximumFractionDigits:4})} ${log.asset}</span>
                <span class="ledger-time">${log.time.split(' ')[1]}</span>
                <span class="ledger-status">${log.status}</span>
            </div>
        `;
    }).join('');
}

export function updateWalletUI() {
    const isBtc = state.currentSymbol === 'BTC-USD';
    const coin = isBtc ? 'BTC' : 'ADA';
    const fiat = isBtc ? 'USD' : 'KRW';
    const unit = isBtc ? '$' : '₩';

    // Update balances labels in header and cards
    const assetKrw = document.getElementById('asset-krw');
    const assetUsd = document.getElementById('asset-usd');
    const assetBtc = document.getElementById('asset-btc');
    const assetAda = document.getElementById('asset-ada');

    if (assetKrw) assetKrw.innerText = state.balances.KRW.toLocaleString() + ' KRW';
    if (assetUsd) assetUsd.innerText = state.balances.USD.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' USD';
    if (assetBtc) assetBtc.innerText = state.balances.BTC.toFixed(8) + ' BTC';
    if (assetAda) assetAda.innerText = state.balances.ADA.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' ADA';

    // Order availability Display
    const availDisplay = document.getElementById('avail-balance-display');
    if (availDisplay) {
        availDisplay.innerText = unit + state.balances[fiat].toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    // Compute actual portfolio ROI
    const book = books[state.currentSymbol];
    if (!book) return;
    
    const sortedBids = Array.from(book.bids.entries()).filter(([_, q]) => q > 0).sort((a, b) => b[0] - a[0]);
    const sortedAsks = Array.from(book.asks.entries()).filter(([_, q]) => q > 0).sort((a, b) => a[0] - b[0]);

    let currentPrice = 0;
    if (sortedBids.length > 0 && sortedAsks.length > 0) {
        currentPrice = ((sortedBids[0][0] + sortedAsks[0][0]) / 2) / 100;
    }

    const totalEl = document.getElementById('portfolio-total');
    const pnlEl = document.getElementById('portfolio-pnl');

    if (currentPrice === 0) {
        if (totalEl) totalEl.innerText = '--';
        if (pnlEl) pnlEl.innerText = '--';
        return;
    }

    const coinBalance = state.balances[coin];
    const pf = state.myPortfolio[state.currentSymbol] || { qty: 0, avgPrice: 0 };

    if (pf.avgPrice === 0 && coinBalance > 0) {
        pf.avgPrice = currentPrice;
        pf.qty = coinBalance;
        state.myPortfolio[state.currentSymbol] = pf;
        saveWallet();
    }

    const totalFiatValue = state.balances[fiat];
    const coinFiatValue = coinBalance * currentPrice;
    const totalAssetValue = totalFiatValue + coinFiatValue;

    const pnl = coinBalance * (currentPrice - pf.avgPrice);
    const roi = pf.avgPrice > 0 && coinBalance > 0 ? (pnl / (coinBalance * pf.avgPrice)) * 100 : 0;

    if (totalEl) totalEl.innerText = unit + totalAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (pnlEl) {
        const roiSign = pnl >= 0 ? '+' : '';
        pnlEl.innerText = `${roiSign}${unit}${pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${roiSign}${roi.toFixed(2)}%)`;
        if (pnl > 0) {
            pnlEl.style.color = '#ef4444';
        } else if (pnl < 0) {
            pnlEl.style.color = '#3b82f6';
        } else {
            pnlEl.style.color = 'var(--color-text-primary)';
        }
    }
}

// Portfolio charts state
let apexChartInstance = null;

export function showReportModal() {
    const modal = document.getElementById('report-modal');
    if (!modal) return;
    
    modal.classList.add('active');

    // Calc stats for report
    const isBtc = state.currentSymbol === 'BTC-USD';
    const coin = isBtc ? 'BTC' : 'ADA';
    const fiat = isBtc ? 'USD' : 'KRW';
    const unit = isBtc ? '$' : '₩';
    
    const pf = state.myPortfolio[state.currentSymbol] || { qty: 0, avgPrice: 0 };
    const coinBalance = state.balances[coin];
    
    // Compute currentPrice
    const book = books[state.currentSymbol];
    let currentPrice = pf.avgPrice || 100;
    if (book) {
        const sortedBids = Array.from(book.bids.entries()).filter(([_, q]) => q > 0).sort((a,b)=>b[0]-a[0]);
        const sortedAsks = Array.from(book.asks.entries()).filter(([_, q]) => q > 0).sort((a,b)=>a[0]-b[0]);
        if (sortedBids.length > 0 && sortedAsks.length > 0) {
            currentPrice = ((sortedBids[0][0] + sortedAsks[0][0]) / 2) / 100;
        }
    }
    
    const pnl = coinBalance * (currentPrice - pf.avgPrice);
    const roi = pf.avgPrice > 0 && coinBalance > 0 ? (pnl / (coinBalance * pf.avgPrice)) * 100 : 0.0;
    
    const yieldEl = document.getElementById('report-yield');
    const roiSign = pnl >= 0 ? '+' : '';
    yieldEl.innerText = `${roiSign}${roi.toFixed(2)}%`;
    yieldEl.className = pnl > 0 ? 'card-val text-red' : (pnl < 0 ? 'card-val text-blue' : 'card-val');

    // Simulate 24H fees
    const mockFees = (state.ledger.length * 2.15 + 4.5).toFixed(2);
    document.getElementById('report-fees').innerText = `${unit}${mockFees}`;

    // Render ApexCharts ROI trace
    setTimeout(() => {
        const chartContainer = document.getElementById('apex-roi-chart');
        if (!chartContainer) return;
        
        // Generate mock points based on ledger & price
        const mockSeriesData = [];
        let runningVal = state.balances[fiat];
        for(let i=0; i<10; i++) {
            runningVal += (Math.random() - 0.45) * runningVal * 0.02;
            mockSeriesData.push(Math.round(runningVal));
        }

        const options = {
            chart: {
                type: 'area',
                height: 250,
                background: 'transparent',
                foreColor: '#94a3b8',
                toolbar: { show: false }
            },
            series: [{
                name: '총 가용 자산 가치',
                data: mockSeriesData
            }],
            xaxis: {
                categories: ['D-9', 'D-8', 'D-7', 'D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', '오늘'],
                labels: { style: { colors: '#94a3b8' } }
            },
            stroke: {
                curve: 'smooth',
                width: 3,
                colors: ['#00f2fe']
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.45,
                    opacityTo: 0.05,
                    colorStops: [
                        { offset: 0, color: '#00f2fe', opacity: 0.5 },
                        { offset: 100, color: '#8a2be2', opacity: 0.0 }
                    ]
                }
            },
            grid: { borderColor: 'rgba(255,255,255,0.05)' },
            theme: { mode: 'dark' }
        };

        if (apexChartInstance) {
            apexChartInstance.destroy();
        }
        
        apexChartInstance = new ApexCharts(chartContainer, options);
        apexChartInstance.render();
    }, 200);
}

export function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.remove('active');
}
