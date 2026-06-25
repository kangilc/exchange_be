package exchange.kafka;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;

/**
 * 애플리케이션의 설정 정보를 로드하는 유틸리티 클래스입니다.
 * <p>
 * 설정 값을 가져오는 우선순위는 다음과 같습니다:
 * 1. JVM 시스템 프로퍼티 (System.getProperty)
 * 2. OS 환경 변수 (System.getenv)
 * 3. 프로필별 환경 설정 파일 (.env.dev, .env.prd 등)
 * </p>
 */
public final class ConfigLoader {
    // .env.[profile] 파일에서 읽은 설정값들을 저장하는 캐시 맵
    private static final Map<String, String> localProperties = new HashMap<>();
    // 실행 시 지정된 애플리케이션 프로필 (기본값: dev)
    private static final String profile;

    static {
        // 1. env.profile 시스템 프로퍼티 확인
        String p = System.getProperty("env.profile");
        // 2. 시스템 프로퍼티가 없는 경우 ENV_PROFILE 환경 변수 확인
        if (p == null || p.isEmpty()) {
            p = System.getenv("ENV_PROFILE");
        }
        // 3. 둘 다 없는 경우 기본 프로필로 "dev" 적용
        if (p == null || p.isEmpty()) {
            p = "dev";
        }
        profile = p.toLowerCase().trim();
        
        System.out.println("ConfigLoader initialized with profile: " + profile);
        
        // 현재 프로필에 매핑되는 설정 파일명 결정 (예: .env.dev)
        String filename = ".env." + profile;
        File file = new File(filename);
        // 실행 위치에 따라 루트 디렉토리 기준 상위 경로도 체크
        if (!file.exists()) {
            file = new File("../" + filename);
        }
        
        // 설정 파일이 존재하는 경우 파일에서 설정을 한 줄씩 읽어 맵에 적재
        if (file.exists()) {
            System.out.println("Loading configuration profile file: " + file.getAbsolutePath());
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    // 빈 줄이나 주석(#)은 건너뜀
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    
                    // "KEY=VALUE" 형태 파싱
                    String[] parts = line.split("=", 2);
                    if (parts.length == 2) {
                        String key = parts[0].trim();
                        String value = parts[1].trim();
                        localProperties.put(key, value);
                    }
                }
            } catch (Exception e) {
                System.err.println("Warning: Failed to load environment profile file " + filename + ": " + e.getMessage());
            }
        } else {
            System.out.println("No local config profile file '" + filename + "' found. Relying on System environment variables.");
        }
    }

    /**
     * 지정한 키에 해당하는 설정 값을 조회합니다.
     * JVM 옵션(-D) -> OS 환경변수 -> .env 설정 파일 순서로 탐색합니다.
     * 
     * @param key 설정 키 이름
     * @return 조회된 설정 값 (존재하지 않으면 null)
     */
    public static String get(String key) {
        // 1. JVM 프로퍼티 조회
        String value = System.getProperty(key);
        if (value != null) return value;
        
        // 2. OS 환경 변수 조회
        value = System.getenv(key);
        if (value != null) return value;
        
        // 3. 로컬 .env 프로필 파일 로딩 값 조회
        return localProperties.get(key);
    }

    /**
     * 지정한 키에 해당하는 설정 값을 조회하되, 값이 없는 경우 기본값을 반환합니다.
     * 
     * @param key 설정 키 이름
     * @param defaultValue 값이 없을 경우 적용할 기본값
     * @return 설정 값 또는 기본값
     */
    public static String get(String key, String defaultValue) {
        String value = get(key);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }

    /**
     * 지정한 키에 해당하는 정수형 설정 값을 조회합니다.
     * 
     * @param key 설정 키 이름
     * @param defaultValue 정수 변환 실패 또는 값이 없을 경우 적용할 기본값
     * @return 정수형 설정 값
     */
    public static int getInt(String key, int defaultValue) {
        String value = get(key);
        if (value == null || value.isEmpty()) return defaultValue;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * 지정한 키에 해당하는 불리언 설정 값을 조회합니다.
     * 
     * @param key 설정 키 이름
     * @param defaultValue 값이 없을 경우 적용할 기본값
     * @return 불리언 설정 값
     */
    public static boolean getBoolean(String key, boolean defaultValue) {
        String value = get(key);
        if (value == null || value.isEmpty()) return defaultValue;
        return Boolean.parseBoolean(value);
    }

    /**
     * 현재 로드된 애플리케이션의 프로필 이름을 반환합니다.
     * 
     * @return 프로필 이름 (예: "dev", "prd", "qa")
     */
    public static String getProfile() {
        return profile;
    }
}

