package exchange.admin.dto.request.wallet;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * 핫월렛 자산 리밸런싱(충전) 요청을 위한 IDT (Input Data Transfer) 객체
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RebalanceRequestIDT {
    /** 충전하고자 하는 금액 */
    private BigDecimal amount;
}
