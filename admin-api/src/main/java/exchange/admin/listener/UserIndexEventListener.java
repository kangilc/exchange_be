package exchange.admin.listener;

import exchange.admin.document.UserDocument;
import exchange.admin.model.User;
import exchange.admin.repository.es.UserSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 회원 색인 이벤트를 수신하여 비동기(Async) 및 트랜잭션 커밋 완료 후에 엘라스틱서치 인덱스를 갱신하는 이벤트 리스너.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserIndexEventListener {

    private final UserSearchRepository userSearchRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUserIndexedEvent(UserIndexedEvent event) {
        User user = event.getUser();
        String userIdStr = String.valueOf(user.getUserId());
        try {
            if (event.isDelete()) {
                userSearchRepository.deleteById(userIdStr);
                log.info("[Elasticsearch] User index deleted: {}", userIdStr);
            } else {
                UserDocument doc = UserDocument.builder()
                        .id(userIdStr)
                        .email(user.getEmail())
                        .status(user.getStatus())
                        .grade(user.getGrade() != null ? user.getGrade().name() : null)
                        .role(user.getRole() != null ? user.getRole().name() : null)
                        .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() : System.currentTimeMillis())
                        .build();
                userSearchRepository.save(doc);
                log.info("[Elasticsearch] User index updated: {}", userIdStr);
            }
        } catch (Exception e) {
            log.error("[Elasticsearch] Failed to index user: {}, error: {}", userIdStr, e.getMessage(), e);
        }
    }
}
