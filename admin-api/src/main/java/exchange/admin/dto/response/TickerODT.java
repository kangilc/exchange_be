package exchange.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 마켓 티커 정보 전송 객체 (Output Data Transfer)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TickerODT {
    private String symbol;
    private long lastPrice;
    private long prevClosePrice;
}
