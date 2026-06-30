package exchange.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 마켓 캔들(OHLCV) 전송 객체 (Output Data Transfer)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandleODT {
    private long time;
    private double open;
    private double high;
    private double low;
    private double close;
    private double volume;
}
