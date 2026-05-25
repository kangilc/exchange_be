# Admin API & Premium Admin Dashboard Frontend Implementation Plan

This plan outlines the design and implementation of the Admin integrated management system. It includes minor enhancements to the `admin-api` backend to support additional statistics and the creation of a stunning, premium, high-tech Admin Frontend Console (`frontend/admin.html`) built with glassmorphic dark-theme aesthetics and interactive data charts.

## Proposed Changes

We will implement the features across both the Backend (`admin-api`) and Frontend components.

---

### 1. [Backend] admin-api Enhancements

The current backend is already very functional, containing robust endpoints for user management (list, update, deposit/withdraw, register), wallet summaries, and time-bucketed trade/ledger statistics. We will make a few enhancements:
1. **User Registration Statistics**: Add a new API to get the number of registered users over time (daily, weekly, monthly, quarterly, annually) using the `created_at` field in `users`.
2. **Total Statistics Summary**: Add an API `/admin/stats/summary` that returns high-level metrics (Total Users, Today's Trade Count, Total Trade Volume, Active Wallets count) to populate the main dashboard cards.

#### [NEW] [UserStatsProjection.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/repository/UserRepository.java)
We will add a projection and a native query to `UserRepository.java` for fetching user registration stats:
```java
interface UserStatsProjection {
    String getBucket();
    Long getUserCount();
}
```

#### [MODIFY] [UserRepository.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/repository/UserRepository.java)
Add native query for user registration count grouped by `date_trunc(:timeBucket, created_at)`.

#### [MODIFY] [StatsService.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/service/StatsService.java)
Add service methods to calculate:
- User stats over time buckets.
- High-level system-wide stats summary (total users, total trade volume, total wallets).

#### [MODIFY] [StatsController.java](file:///home/administrator/exchange_be/admin-api/src/main/java/exchange/admin/controller/StatsController.java)
Add endpoints:
- `GET /admin/stats/users` with resolution parameter.
- `GET /admin/stats/summary` to return overall system summary metrics.

---

### 2. [Frontend] Standalone Premium Admin Console

We will create a highly responsive, standalone single-page application `frontend/admin.html` that uses a stunning dark-theme glassmorphic design matching the main trade terminal (`main.html`), integrating with `admin-api` REST endpoints.

#### [NEW] [admin.html](file:///home/administrator/exchange_be/frontend/admin.html)
A complete standalone HTML5 application featuring:
1. **Glassmorphic UI Design System**:
   - Deep background with neon glowing highlights, clean borders (`--border-glow`), violet and cyan secondary details, premium typography (Outfit, Noto Sans KR, Fira Code).
   - Sidebar-based navigation: Dashboard, User Management, Wallet/Asset Management, Stat Analysis.
2. **Main Dashboard Dashboard View**:
   - System overall stats cards: Total Users, 24h Trades, Total Volume, Wallet assets.
   - Live trading volume chart (last 30 days) and asset flows.
3. **Stat Analysis Panel (현황 및 통계)**:
   - Interactive line/area charts using **ApexCharts** loaded from CDN.
   - Filter dropdowns for resolution: **Daily (일간), Weekly (주간), Monthly (월간), Quarterly (분기), Annual (연간)**.
   - Seamless REST API data binding for Trade volumes and Deposit/Withdrawal ledger history.
4. **User Integrated Management Panel (회원 통합 관리)**:
   - Data table of all users with search, sort, and status highlights.
   - **Register User Modal** (Email, Password, Grade).
   - **Edit User Modal** (Change Email, Status, Grade).
   - **Adjust Assets Panel**: Select user, select currency (KRW, USD, BTC, ADA), enter amount, and trigger DEPOSIT/WITHDRAWAL (internally maps to `/admin/users/{id}/assets/adjust`).
5. **Wallet/Asset Management Panel (지갑 및 자산 현황)**:
   - Beautiful dashboard cards and horizontal progress bars showing the total amount of assets in the exchange (e.g. Total KRW, Total BTC, Total USD, Total ADA, and their locked percentages) using `/admin/wallets/summary`.
   - Comprehensive table of all user wallets with custom currency labels.
6. **Smart API Configuration**:
   - Automatically detects API host IP (defaulting to the host URL or a configurable field in the UI so the user can easily point it to their WSL IP if needed).

---

## Verification Plan

### Automated Tests & Quality Controls
- Compile the Spring Boot project to ensure all JPA projections and repository queries are syntax-clean.
- Launch the `admin-api` and test the newly added APIs (`/admin/stats/summary`, `/admin/stats/users`) using curl.

### Manual Verification
- Open [admin.html](file:///home/administrator/exchange_be/frontend/admin.html) directly in a web browser.
- Verify navigation between Dashboard, Users, Wallets, and Stats tabs.
- Test creating a new user and modifying an existing user's grade or status.
- Test adjusting a user's asset balance (depositing KRW/BTC) and check if it successfully updates in the wallet table.
- Verify that ApexCharts render beautiful responsive charts representing trade volumes and asset transactions for daily, weekly, monthly, quarterly, and annual granularities.
