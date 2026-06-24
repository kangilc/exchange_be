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
            "marketFeeRates", AdminSettings.getMarketFeeRates()
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
        if (request.containsKey("marketFeeRates")) {
            Object val = request.get("marketFeeRates");
            if (val instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rates = (Map<String, Object>) val;
                for (Map.Entry<String, Object> entry : rates.entrySet()) {
                    String symbol = entry.getKey();
                    if (entry.getValue() instanceof Number) {
                        double rate = ((Number) entry.getValue()).doubleValue();
                        AdminSettings.setFeeRate(symbol, rate);
                        updateFeeInDb(symbol, rate);
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

    private void updateFeeInDb(String symbol, double rate) {
        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. markets 테이블 업데이트 (updated_at 은 DB DEFAULT/Trigger 없이 명시적 업데이트 또는 RETURNING 활용)
                java.sql.Timestamp now = new java.sql.Timestamp(System.currentTimeMillis());
                String updater = "admin_system";
                
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE markets SET fee_rate = ?, updated_at = ?, updated_by = ? WHERE symbol = ?")) {
                    ps.setDouble(1, rate);
                    ps.setTimestamp(2, now);
                    ps.setString(3, updater);
                    ps.setString(4, symbol);
                    ps.executeUpdate();
                }

                double finalFee = 0;
                int priceDecimals = 2;
                java.math.BigDecimal minAmt = java.math.BigDecimal.valueOf(0.0001);
                String status = "ACTIVE";
                java.sql.Timestamp dbCreatedAt = now;
                java.sql.Timestamp dbUpdatedAt = now;
                String dbCreatedBy = updater;
                String dbUpdatedBy = updater;

                try (PreparedStatement psSelect = conn.prepareStatement(
                        "SELECT fee_rate, price_decimals, min_amt, status, created_at, updated_at, created_by, updated_by FROM markets WHERE symbol = ?")) {
                    psSelect.setString(1, symbol);
                    try (java.sql.ResultSet rs = psSelect.executeQuery()) {
                        if (rs.next()) {
                            finalFee = rs.getDouble("fee_rate");
                            priceDecimals = rs.getInt("price_decimals");
                            minAmt = rs.getBigDecimal("min_amt");
                            status = rs.getString("status");
                            dbCreatedAt = rs.getTimestamp("created_at");
                            dbUpdatedAt = rs.getTimestamp("updated_at");
                            dbCreatedBy = rs.getString("created_by");
                            dbUpdatedBy = rs.getString("updated_by");
                        }
                    }
                }

                // 3. market_histories 에 명시적 로그 인서트 (markets 의 audit 정보를 그대로 삽입)
                try (PreparedStatement psHist = conn.prepareStatement(
                        "INSERT INTO market_histories (symbol, fee_rate, price_decimals, min_amt, status, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                    psHist.setString(1, symbol);
                    psHist.setDouble(2, finalFee);
                    psHist.setInt(3, priceDecimals);
                    psHist.setBigDecimal(4, minAmt);
                    psHist.setString(5, status);
                    psHist.setTimestamp(6, dbCreatedAt);
                    psHist.setTimestamp(7, dbUpdatedAt);
                    psHist.setString(8, dbCreatedBy);
                    psHist.setString(9, dbUpdatedBy);
                    psHist.executeUpdate();
                }

                conn.commit();
                log.info("Successfully updated market fee and inserted history for {} to {}", symbol, rate);
            } catch (Exception e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            log.error("Failed to update fee rate in DB for " + symbol, e);
        }
    }
}
