package exchange.kafka;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.Map;

public final class ConfigLoader {
    private static final Map<String, String> localProperties = new HashMap<>();
    private static final String profile;

    static {
        String p = System.getProperty("env.profile");
        if (p == null || p.isEmpty()) {
            p = System.getenv("ENV_PROFILE");
        }
        if (p == null || p.isEmpty()) {
            p = "dev";
        }
        profile = p.toLowerCase().trim();
        
        System.out.println("ConfigLoader initialized with profile: " + profile);
        
        String filename = ".env." + profile;
        File file = new File(filename);
        if (!file.exists()) {
            file = new File("../" + filename);
        }
        
        if (file.exists()) {
            System.out.println("Loading configuration profile file: " + file.getAbsolutePath());
            try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    
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

    public static String get(String key) {
        String value = System.getProperty(key);
        if (value != null) return value;
        
        value = System.getenv(key);
        if (value != null) return value;
        
        return localProperties.get(key);
    }

    public static String get(String key, String defaultValue) {
        String value = get(key);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }

    public static int getInt(String key, int defaultValue) {
        String value = get(key);
        if (value == null || value.isEmpty()) return defaultValue;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public static boolean getBoolean(String key, boolean defaultValue) {
        String value = get(key);
        if (value == null || value.isEmpty()) return defaultValue;
        return Boolean.parseBoolean(value);
    }

    public static String getProfile() {
        return profile;
    }
}
