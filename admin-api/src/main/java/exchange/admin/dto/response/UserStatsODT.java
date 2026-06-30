package exchange.admin.dto.response;

public class UserStatsODT {
    private String bucket;
    private Long userCount;

    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }

    public Long getUserCount() { return userCount; }
    public void setUserCount(Long userCount) { this.userCount = userCount; }
}
