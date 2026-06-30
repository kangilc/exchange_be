package exchange.admin.dto.request.user;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * 특정 회원의 자산 수동 조정 요청 시 사용되는 IDT 객체.
 */
@Data
public class AssetAdjustIDT {

    @NotBlank(message = "Currency is required")
    private String currency;

    @NotNull(message = "Amount is required")
    private BigDecimal amount;
    
    private String reason;
}
