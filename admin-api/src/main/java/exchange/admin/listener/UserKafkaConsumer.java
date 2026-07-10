package exchange.admin.listener;

import exchange.admin.document.UserDocument;
import exchange.admin.dto.UserSyncMessage;
import exchange.admin.repository.es.UserSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Kafka 토픽(user-sync-topic)을 구독하여 Elasticsearch 인덱스를 동기화하는 Consumer.
 * DB와 ES 간의 비동기 동기화를 담당하며, 메시지 큐 처리를 통해 결함 감내(Fault Tolerance)를 구현함.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserKafkaConsumer {

    private final UserSearchRepository userSearchRepository;

    // 카프카 색인 전송용 토픽명
    private static final String TOPIC_NAME = "user-sync-topic";

    /**
     * user-sync-topic 토픽의 메시지를 수신하여 Elasticsearch를 갱신함.
     *
     * @param message 수신된 유저 색인 동기화 DTO
     */
    @KafkaListener(topics = TOPIC_NAME, groupId = "admin-api-group")
    public void consumeUserSync(UserSyncMessage message) {
        if (message == null) {
            return;
        }

        String userIdStr = String.valueOf(message.getUserId());
        try {
            if (message.isDelete()) {
                // 삭제 처리
                userSearchRepository.deleteById(userIdStr);
                log.info("[Kafka Consumer] Elasticsearch document deleted for user: {}", userIdStr);
            } else {
                // 저장 및 수정 처리
                UserDocument doc = UserDocument.builder()
                        .id(userIdStr)
                        .email(message.getEmail())
                        .status(message.getStatus())
                        .grade(message.getGrade())
                        .role(message.getRole())
                        // createdAt 미설정 시 현재 시각 대체
                        .createdAt(message.getCreatedAt() != null ? message.getCreatedAt() : System.currentTimeMillis())
                        .build();
                userSearchRepository.save(doc);
                log.info("[Kafka Consumer] Elasticsearch document updated for user: {}", userIdStr);
            }
        } catch (Exception e) {
            // 장애 발생 시 로그를 기록하고, 나중에 필요 시 재시도 또는 수동 조치 대상이 됨
            log.error("[Kafka Consumer] Failed to process user sync in ES: {}, error: {}", userIdStr, e.getMessage(), e);
        }
    }
}
