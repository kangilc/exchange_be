package exchange.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * 어드민 운영 실적 및 KPI 전송 객체 (Output Data Transfer)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PerformanceODT {
    private List<FeeRevenueODT> feeRevenues;
    private ActiveUsersODT activeUsers;
    private List<NetFlowODT> netDepositFlow30d;
    private TradeTurnoverODT tradingVelocity;
    private OrderEfficiencyODT orderEfficiency;
    private List<CompetitorODT> competitors;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FeeRevenueODT {
        private String symbol;
        private String quoteCurrency;
        private double currentFeeRate;
        private double totalVolume;
        private double totalFees;
        private double volume24h;
        private double fees24h;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ActiveUsersODT {
        private long dau24h;
        private long mau30d;
        private double dauMauRatioPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class NetFlowODT {
        private String currency;
        private double netFlow;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TradeTurnoverODT {
        private double totalUserAssetsKrwEquivalent;
        private double totalVolume30dKrwEquivalent;
        private double velocityPercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrderEfficiencyODT {
        private long filledCount;
        private long cancelledCount;
        private long activeCount;
        private double fillRatePercent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CompetitorODT {
        private String exchange;
        private double btcUsdFeeRatePercent;
        private double adaKrwFeeRatePercent;
        private double avgLatencyMs;
        private long tps;
        private double uptimePercent;
    }
}
