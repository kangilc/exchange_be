// 🌌 Smart Wallet Service & Repository Pattern Adaptor Module
import { state, defaultBalances, saveWallet } from './state.js';

export class WalletService {
    async getBalances() { throw new Error("Not implemented"); }
    async deposit(asset, amount) { throw new Error("Not implemented"); }
    async withdraw(asset, amount, address) { throw new Error("Not implemented"); }
    async getLedger() { throw new Error("Not implemented"); }
    async deductOrderCost(fiat, coin, orderTotal, qtyInput, side) { throw new Error("Not implemented"); }
}

export class SandboxWalletService extends WalletService {
    async getBalances() {
        return state.balances;
    }

    async deposit(asset, amount) {
        state.balances[asset] = (state.balances[asset] || 0) + amount;
        
        const txId = 'TXD-' + Math.floor(100000 + Math.random() * 900000);
        const log = {
            txId,
            type: '입금',
            asset,
            amount,
            time: new Date().toLocaleString(),
            status: '완료'
        };
        state.ledger.unshift(log);
        saveWallet();
        return log;
    }

    async withdraw(asset, amount, address) {
        state.balances[asset] -= amount;
        
        const txId = 'TXW-' + Math.floor(100000 + Math.random() * 900000);
        const log = {
            txId,
            type: '출금',
            asset,
            amount,
            time: new Date().toLocaleString(),
            status: '완료'
        };
        state.ledger.unshift(log);
        saveWallet();
        return log;
    }

    async getLedger() {
        return state.ledger;
    }

    async deductOrderCost(fiat, coin, orderTotal, qtyInput, side) {
        if (side === 'BUY') {
            state.balances[fiat] -= orderTotal;
            const pf = state.myPortfolio[state.currentSymbol] || { qty: 0, avgPrice: 0 };
            const currentQty = state.balances[coin];
            const totalCost = (currentQty * pf.avgPrice) + orderTotal;
            const newQty = currentQty + qtyInput;
            const newAvg = newQty > 0 ? (totalCost / newQty) : 0;
            pf.avgPrice = newAvg;
            pf.qty = newQty;
            state.myPortfolio[state.currentSymbol] = pf;
            state.balances[coin] = newQty;
        } else {
            state.balances[coin] -= qtyInput;
            state.balances[fiat] += orderTotal;
            const pf = state.myPortfolio[state.currentSymbol] || { qty: 0, avgPrice: 0 };
            pf.qty = Math.max(0, state.balances[coin]);
            if (pf.qty === 0) pf.avgPrice = 0;
            state.myPortfolio[state.currentSymbol] = pf;
        }
        saveWallet();
    }
}

export class ProductionWalletService extends WalletService {
    constructor() {
        super();
        this.apiHost = 'http://localhost:8081';
        this.userId = 1; // Default seeded user in DB
    }

    async getBalances() {
        try {
            const res = await fetch(`${this.apiHost}/admin/wallets/user/${this.userId}`);
            if (!res.ok) throw new Error("API response error");
            const data = await res.json();
            
            const balances = {};
            data.forEach(w => {
                balances[w.currency] = parseFloat(w.balance);
            });
            state.balances = { ...defaultBalances, ...balances };
            saveWallet();
            return state.balances;
        } catch (e) {
            console.error("Production getBalances error, fallback to local state:", e);
            return state.balances;
        }
    }

    async deposit(asset, amount) {
        try {
            const res = await fetch(`${this.apiHost}/admin/users/${this.userId}/assets/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currency: asset, amount: amount })
            });
            if (!res.ok) throw new Error("API response error");
            
            await this.getBalances();
            
            const txId = 'TXD-' + Math.floor(100000 + Math.random() * 900000);
            const log = {
                txId,
                type: '입금',
                asset,
                amount,
                time: new Date().toLocaleString(),
                status: '완료 (DB)'
            };
            state.ledger.unshift(log);
            saveWallet();
            return log;
        } catch (e) {
            console.error("Production deposit error:", e);
            throw e;
        }
    }

    async withdraw(asset, amount, address) {
        try {
            const res = await fetch(`${this.apiHost}/admin/users/${this.userId}/assets/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currency: asset, amount: -amount })
            });
            if (!res.ok) throw new Error("API response error");
            
            await this.getBalances();
            
            const txId = 'TXW-' + Math.floor(100000 + Math.random() * 900000);
            const log = {
                txId,
                type: '출금',
                asset,
                amount,
                time: new Date().toLocaleString(),
                status: '완료 (DB)'
            };
            state.ledger.unshift(log);
            saveWallet();
            return log;
        } catch (e) {
            console.error("Production withdraw error:", e);
            throw e;
        }
    }

    async getLedger() {
        try {
            const res = await fetch(`${this.apiHost}/admin/users/${this.userId}/ledgers?page=0&size=5`);
            if (!res.ok) throw new Error("API response error");
            const data = await res.json();
            
            const logs = data.content.map(j => ({
                txId: 'TX-' + j.journalId,
                type: j.type === 'DEPOSIT' ? '입금' : (j.type === 'WITHDRAWAL' ? '출금' : j.type),
                asset: j.currency,
                amount: parseFloat(j.amount),
                time: new Date(j.createdAt).toLocaleString(),
                status: 'DB 기록됨'
            }));
            
            state.ledger = logs;
            saveWallet();
            return state.ledger;
        } catch (e) {
            console.error("Production getLedger error, fallback to local state:", e);
            return state.ledger;
        }
    }

    async deductOrderCost(fiat, coin, orderTotal, qtyInput, side) {
        // Immediate local responsive UI simulation
        if (side === 'BUY') {
            state.balances[fiat] -= orderTotal;
            state.balances[coin] = (state.balances[coin] || 0) + qtyInput;
        } else {
            state.balances[coin] -= qtyInput;
            state.balances[fiat] += orderTotal;
        }
        saveWallet();
        
        // Background sync to pull actual settled database balances after execution
        setTimeout(() => this.getBalances(), 1500);
    }
}

// Select active implementation based on isLive mode
export function getActiveWalletService() {
    return state.isLive ? new ProductionWalletService() : new SandboxWalletService();
}
