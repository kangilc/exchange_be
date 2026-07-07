package exchange.admin.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 어플리케이션 전역 설정 관리 클래스.
 * application.yml에 등록된 app 접두사 설정을 바인딩함.
 */
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    // 마켓별 호가 스냅샷 포트 설정 맵
    private Map<String, Integer> marketPorts = new HashMap<>();

    public Map<String, Integer> getMarketPorts() {
        return marketPorts;
    }

    public void setMarketPorts(Map<String, Integer> marketPorts) {
        this.marketPorts = marketPorts;
    }
}
