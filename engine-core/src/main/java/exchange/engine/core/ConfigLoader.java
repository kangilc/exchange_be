package exchange.engine.core;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;

/**
 * 애플리케이션의 설정값을 로드하는 유틸리티 클래스입니다.
 * 시스템 속성(Property), 환경 변수(Environment Variable), 로컬 프로필 파일(.env.<profile>) 순서로
 * 설정값을 읽어와 제공합니다.
 */
public final class ConfigLoader {
    // 로컬 프로필 파일(.env.dev 등)에서 읽어온 설정값을 임시 저장할 맵
    private static final Map<String, String> localProperties = new HashMap<>();
    // 현재 활성화된 프로필 환경명 (예: dev, prod 등)
    private static final String profile;

    static {
        // 1. 활성 프로필 확인 (우선순위: 시스템 속성 env.profile -> 환경변수 ENV_PROFILE -> 기본값 'dev')
        String p = System.getProperty("env.profile");
        if (p == null || p.isEmpty()) {
            p = System.getenv("ENV_PROFILE");
        }
        if (p == null || p.isEmpty()) {
            p = "dev";
        }
        profile = p.toLowerCase().trim();
        
        System.out.println("ConfigLoader initialized with profile: " + profile);
        
        // 2. 로컬 환경 설정 파일(.env.<profile>) 탐색 및 로드
        String filename = ".env." + profile;
        File file = new File(filename);
        if (!file.exists()) {
            // 현재 디렉토리에 없는 경우, 상위 디렉토리에서 재탐색
            file = new File("../" + filename);
        }
        
        if (file.exists()) {
            System.out.println("Loading configuration profile file: " + file.getAbsolutePath());
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    // 빈 줄이거나 주석(#)으로 시작하는 줄은 스킵
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    
                    // 'key=value' 형식 파싱 (최대 2개 파트로 분할하여 value 내부에 =가 포함되어도 안전하도록 처리)
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
     * 지정한 키에 대한 설정값을 조회합니다.
     * 조회 우선순위: 
     * 1. Java 시스템 속성 (-Dkey=value)
     * 2. 운영체제 환경 변수 (export key=value)
     * 3. 로컬 프로필 설정 파일 (.env.dev 등)
     * 
     * @param key 조회할 설정 키
     * @return 설정값 (없을 경우 null)
     */
    public static String get(String key) {
        String value = System.getProperty(key);
        if (value != null) return value;
        
        value = System.getenv(key);
        if (value != null) return value;
        
        return localProperties.get(key);
    }

    /**
     * 지정한 키에 대한 설정값을 조회하고, 값이 없을 경우 기본값을 반환합니다.
     * 
     * @param key 조회할 설정 키
     * @param defaultValue 값이 없을 경우 사용할 기본값
     * @return 설정값 또는 기본값
     */
    public static String get(String key, String defaultValue) {
        String value = get(key);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }

    /**
     * 지정한 키에 대한 설정값을 정수형(int)으로 조회합니다.
     * 
     * @param key 조회할 설정 키
     * @param defaultValue 값이 없거나 파싱 불가능할 때 사용할 기본값
     * @return 정수 설정값 또는 기본값
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
     * 지정한 키에 대한 설정값을 불리언(boolean) 타입으로 조회합니다.
     * 
     * @param key 조회할 설정 키
     * @param defaultValue 값이 없을 경우 사용할 기본값
     * @return boolean 설정값 또는 기본값
     */
    public static boolean getBoolean(String key, boolean defaultValue) {
        String value = get(key);
        if (value == null || value.isEmpty()) return defaultValue;
        return Boolean.parseBoolean(value);
    }

    /**
     * 현재 활성화된 설정 프로필명을 반환합니다.
     * 
     * @return 활성 프로필명 (dev, prod 등)
     */
    public static String getProfile() {
        return profile;
    }
}
