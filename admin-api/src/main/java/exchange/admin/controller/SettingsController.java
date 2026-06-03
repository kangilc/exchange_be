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
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled()
        ));
    }

    @PostMapping
    public ResponseEntity<?> updateSettings(@RequestBody Map<String, Boolean> request) {
        Boolean enabled = request.get("duplicateLoginBlockEnabled");
        if (enabled != null) {
            AdminSettings.setDuplicateLoginBlockEnabled(enabled);
        }
        return ResponseEntity.ok(Map.of(
            "duplicateLoginBlockEnabled", AdminSettings.isDuplicateLoginBlockEnabled()
        ));
    }
}
