package exchange.admin.controller;

import exchange.admin.config.AdminSettings;
import exchange.admin.service.MarketService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 어드민 서비스 동적 제어 설정을 위한 REST 컨트롤러.
 * 중복 로그인 방지 여부, 온체인 입금 모니터링 여부, 가상 블록체인 시뮬레이션 여부, 코인별 컨펌 수 및 수수료율 설정을 조회하고 수정합니다.
 */
@RestController
@RequestMapping("/admin/settings")
@CrossOrigin(origins = "*")
public class SettingsController {

    private static final Logger log = LoggerFactory.getLogger(SettingsController.class);
    private final MarketService marketService;

    public SettingsController(MarketService marketService) {
        this.marketService = marketService;
    }

    /**
     * 현재 적용 중인 모든 어드민 전역 설정을 일괄 조회합니다.
     * 
     * @return 200 OK와 함께 현재 설정값 맵 반환
     */
    @GetMapping
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations(),
            "marketFeeRates", AdminSettings.getMarketFeeRates()
        ));
    }

    /**
     * 어드민 전역 설정을 동적으로 변경합니다.
     * 변경 가능한 값: 중복로그인차단여부, 입금모니터링여부, 시뮬레이션여부, 코인별컨펌수, 마켓수수료율 등
     * 
     * @param request 변경하고자 하는 필드와 값들의 맵
     * @return 200 OK와 함께 최종 변경이 적용된 설정값 맵 반환
     */
    @PostMapping
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Object> request) {
        if (request.containsKey("duplicateLoginBlockEnabled")) {
            Object val = request.get("duplicateLoginBlockEnabled");
            if (val instanceof Boolean) {
                AdminSettings.setDuplicateLoginBlockEnabled((Boolean) val);
            }
        }
        if (request.containsKey("onChainDepositMonitoringEnabled")) {
            Object val = request.get("onChainDepositMonitoringEnabled");
            if (val instanceof Boolean) {
                AdminSettings.setOnChainDepositMonitoringEnabled((Boolean) val);
            }
        }
        if (request.containsKey("walletSimulationEnabled")) {
            Object val = request.get("walletSimulationEnabled");
            if (val instanceof Boolean) {
                AdminSettings.setWalletSimulationEnabled((Boolean) val);
            }
        }
        if (request.containsKey("btcConfirmations")) {
            Object val = request.get("btcConfirmations");
            if (val instanceof Number) {
                AdminSettings.setBtcConfirmations(((Number) val).intValue());
            }
        }
        if (request.containsKey("ethConfirmations")) {
            Object val = request.get("ethConfirmations");
            if (val instanceof Number) {
                AdminSettings.setEthConfirmations(((Number) val).intValue());
            }
        }
        if (request.containsKey("adaConfirmations")) {
            Object val = request.get("adaConfirmations");
            if (val instanceof Number) {
                AdminSettings.setAdaConfirmations(((Number) val).intValue());
            }
        }
        if (request.containsKey("marketFeeRates")) {
            Object val = request.get("marketFeeRates");
            if (val instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rates = (Map<String, Object>) val;
                for (Map.Entry<String, Object> entry : rates.entrySet()) {
                    String symbol = entry.getKey();
                    if (entry.getValue() instanceof Number) {
                        double rate = ((Number) entry.getValue()).doubleValue();
                        marketService.updateMarketFee(symbol, rate);
                    }
                }
            }
        }
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations(),
            "marketFeeRates", AdminSettings.getMarketFeeRates()
        ));
    }
}
