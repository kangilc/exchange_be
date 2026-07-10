package exchange.admin.listener;

import exchange.admin.dto.UserSyncMessage;
import exchange.admin.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * UserIndexedEvent를 수신하여 Kafka 토픽으로 변경 내역을 발행하는 이벤트 리스너 (Producer).
 *
 * [처리 흐름]
 * 1. JPA가 User 엔티티 변경(INSERT/UPDATE/DELETE)을 감지
 * 2. UserEntityListener(JPA 콜백)가 UserIndexedEvent 발행
 * 3. 트랜잭션 커밋 완료 후 이 리스너가 호출됨
 * 4. UserSyncMessage DTO로 변환 후 Kafka의 user-sync-topic 토픽으로 메시지 발행
 *
 * [@TransactionalEventListener(phase = AFTER_COMMIT) 적용 이유]
 * 트랜잭션이 롤백되면 이벤트를 전송하지 않음으로써 DB와 메시지 큐 간 최종 일관성을 확보함.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserIndexEventListener {

    private final KafkaTemplate<String, UserSyncMessage> kafkaTemplate;

    // 카프카 색인 전송용 토픽명
    private static final String TOPIC_NAME = "user-sync-topic";

    /**
     * 트랜잭션 커밋 완료 후 비동기로 호출되어 Kafka로 색인 변경 메시지를 전송함.
     *
     * @param event 색인 대상 유저 정보 및 삭제 여부를 담은 이벤트 객체
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUserIndexedEvent(UserIndexedEvent event) {
        User user = event.getUser();
        if (user == null) {
            return;
        }

        Long userId = user.getUserId();
        try {
            // 엔티티를 카프카 전송용 DTO로 변환
            UserSyncMessage message = UserSyncMessage.from(user, event.isDelete());

            // Kafka 토픽으로 메시지 발행 (Key: userId, Value: DTO)
            kafkaTemplate.send(TOPIC_NAME, String.valueOf(userId), message)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.error("[Kafka] Failed to publish user sync message for user: {}, error: {}", userId, ex.getMessage(), ex);
                        } else {
                            log.info("[Kafka] User sync message published successfully to topic '{}' for user: {}", TOPIC_NAME, userId);
                        }
                    });
        } catch (Exception e) {
            log.error("[Kafka] Error preparing user sync message for user: {}, error: {}", userId, e.getMessage(), e);
        }
    }
}
