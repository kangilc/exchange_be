# Admin integrated management system Walkthrough

We have successfully designed, implemented, and verified the Admin Console and statistics system. It includes minor Spring Boot repository upgrades to query time-bucketed user metrics, and a stunning glassmorphic dark-theme Admin Frontend Dashboard ([admin.html](file:///home/administrator/exchange_be/frontend/admin.html)) built with **ApexCharts** for real-time visualization.

---

## Technical Accomplishments

### 1. Spring Boot API Enhancements (`admin-api`)
To power the newly created dashboard charts and statistics, we extended the Spring Boot controllers and repositories:
- **System Stats Summary Endpoint** (`/admin/stats/summary`): Compiles high-level exchange metrics including Total Users, Total Active Wallets, Today's Trade Count, and Cumulative Trade Volume.
- **Dynamic User Metrics Endpoint** (`/admin/stats/users`): Fetches the number of user registrations over time (daily, weekly, monthly, quarterly, annually).
- **PostgreSQL Group-By Normalization**: Standardized all native native queries across [UserRepository.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/repository/UserRepository.java), [TradeRepository.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/repository/TradeRepository.java), and [LedgerJournalRepository.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/repository/LedgerJournalRepository.java) to use the `GROUP BY 1` column index. This eliminates native query parsing differences and parameter-binding mismatch errors in PostgreSQL.

### 2. Standalone Premium Admin Frontend (`frontend/admin.html`)
Created a standalone SPA [admin.html](file:///home/administrator/exchange_be/frontend/admin.html) styled with a glowing dark-mode aesthetic (Outfit & Noto Sans font families, violet/cyan borders, glowing cards, transparent glassmorphic backgrounds) matching the user's trading terminal:
- **📊 Dashboard Tab**: Shows summary cards and progress bars depicting the total holdings of KRW, USD, BTC, and ADA in the exchange.
- **👥 User Integrated Management Tab**: Provides an elegant data table listing all registered users with dynamic email search, a register modal, and user metadata edit actions.
- **💸 User Asset Adjustment Modal**: Admin can deposit/withdraw any currency (KRW, USD, BTC, ADA) directly into/from a user's wallet. It automatically records a ledger transaction to the `ledger_journal` table for auditable compliance.
- **💼 Wallets & Coins Tab**: Displays exchange overall currency stats cards and a detailed table of all individual wallets.
- **📈 Stats Tab**: Interactively charts historical trends for daily, weekly, monthly, quarterly, and annual granularities:
  - Cumulative Trade counts and Volume (Dual Column + Area chart)
  - User Registration inflow rate (Bar chart)
  - Inflow vs Outflow asset volumes (Donut chart)
- **⚙️ Dynamic API Binding**: Features a configurable input in the header to point the frontend to the correct `admin-api` IP/host (perfect for WSL virtual environments).

---

### 3. Chart Resolutions Expansion (1W, 1MO, 1Y)
- **Scale Optimization**: Added `findTop50000BySymbolOrderByCreatedAtDesc` to `TradeRepository` and expanded memory-based candle aggregation logic up to 50,000 trades in `StatsService` to correctly group trades into weekly, monthly, and yearly candles.
- **Frontend Sync**: Integrated `1w`, `1mo`, and `1y` resolution buttons into the TradingView Lightweight Charts component (`TradingViewChart.tsx`) across all react modules (`frontend-admin`, `frontend-user`, and `frontend-react`).

### 4. Promtail Log Rendering Fix
- **Template Correction**: Replaced variable mapping using `.Entry` combined with the docker parser to eliminate `<no value>` output issues in Ganache JSON-RPC logs, rendering full Korean descriptions safely.

---

## Verification Results

We verified all backend and frontend services:

### 1. REST API Integration Testing
- Checked `/admin/stats/summary`:
  ```json
  {"totalVolume":2.412299149E7,"totalUsers":100,"totalWallets":301,"totalTrades":9925}
  ```
- Checked `/admin/stats/users?resolution=daily`:
  ```json
  [{"bucket":"2026-05-25 00:00:00","userCount":100}]
  ```
- Checked `/admin/stats/trades?resolution=daily`:
  ```json
  [{"bucket":"2026-05-25 00:00:00","totalQty":42164,"tradeCount":9925,"avgPrice":57225.250377833756,"totalVolume":2.412299149E7}]
  ```

All endpoints are fully operational and return accurate data instantaneously!

### 2. UI Verification
- Built the `admin.html` page cleanly, keeping elements responsive and visually optimized.
- Confirmed there are no errors in CSS layout or script bindings. All charts render beautifully using **ApexCharts**.
- Verified `1w`, `1mo`, and `1y` buttons and their chart drawings in all three React apps.
- Verified that newer Ganache `eth_blockNumber` logs show up in Loki with descriptive text.
