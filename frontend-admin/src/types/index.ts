export interface User {
    userId: number;
    email: string;
    grade: 'STANDARD' | 'VIP';
    status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
    createdAt: string;
}

export interface LedgerEntry {
    createdAt: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    currency: string;
    amount: string;
}

export interface Trade {
    tradeId: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    qty: number;
    executedAt: string;
}
