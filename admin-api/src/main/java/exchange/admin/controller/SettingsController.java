package exchange.admin.controller;

import exchange.admin.config.AdminSettings;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 어드민 서비스 동적 제어 설정을 위한 REST 컨트롤러.
 */
@RestController
@RequestMapping("/admin/settings")
@CrossOrigin(origins = "*")
public class SettingsController {

    private static final Logger log = LoggerFactory.getLogger(SettingsController.class);
    private final DataSource dataSource;

    public SettingsController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping
    public ResponseEntity<?> getSettings() {
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations(),
            "btcUsdFeeRate", AdminSettings.getBtcUsdFeeRate(),
            "adaKrwFeeRate", AdminSettings.getAdaKrwFeeRate()
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
        if (request.containsKey("btcUsdFeeRate")) {
            Object val = request.get("btcUsdFeeRate");
            if (val instanceof Number) {
                double rate = ((Number) val).doubleValue();
                AdminSettings.setBtcUsdFeeRate(rate);
                updateFeeInDb("BTC-USD", rate);
            }
        }
        if (request.containsKey("adaKrwFeeRate")) {
            Object val = request.get("adaKrwFeeRate");
            if (val instanceof Number) {
                double rate = ((Number) val).doubleValue();
                AdminSettings.setAdaKrwFeeRate(rate);
                updateFeeInDb("ADA-KRW", rate);
            }
        }
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled(),
            "onChainDepositMonitoringEnabled", AdminSettings.isOnChainDepositMonitoringEnabled(),
            "walletSimulationEnabled", AdminSettings.isWalletSimulationEnabled(),
            "btcConfirmations", AdminSettings.getBtcConfirmations(),
            "ethConfirmations", AdminSettings.getEthConfirmations(),
            "adaConfirmations", AdminSettings.getAdaConfirmations(),
            "btcUsdFeeRate", AdminSettings.getBtcUsdFeeRate(),
            "adaKrwFeeRate", AdminSettings.getAdaKrwFeeRate()
        ));
    }

    private void updateFeeInDb(String symbol, double rate) {
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO market_fees (symbol, fee_rate) VALUES (?, ?) " +
                     "ON CONFLICT (symbol) DO UPDATE SET fee_rate = EXCLUDED.fee_rate")) {
            ps.setString(1, symbol);
            ps.setDouble(2, rate);
            ps.executeUpdate();
            log.info("Successfully updated fee rate in DB for {} to {}", symbol, rate);
        } catch (SQLException e) {
            log.error("Failed to update fee rate in DB for " + symbol, e);
        }
    }
}
