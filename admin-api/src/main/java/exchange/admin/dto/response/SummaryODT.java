package exchange.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 어드민 대시보드 요약 지표 전송 객체 (Output Data Transfer)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SummaryODT {
    private long totalUsers;
    private long totalTrades;
    private double totalVolume;
    private long totalWallets;
}
