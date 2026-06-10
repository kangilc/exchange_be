package exchange.admin.controller;

import exchange.admin.config.AdminSettings;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 어드민 서비스 동적 제어 설정을 위한 REST 컨트롤러.
 */
@RestController
@RequestMapping("/admin/settings")
@CrossOrigin(origins = "*")
public class SettingsController {

    @GetMapping
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations()
        ));
    }

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
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations()
        ));
    }
}
