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
 * UserIndexedEvent를 수신하여 Elasticsearch 인덱스를 비동기로 동기화하는 이벤트 리스너.
 *
 * [처리 흐름]
 * 1. JPA가 User 엔티티 변경(INSERT/UPDATE/DELETE)을 감지
 * 2. UserEntityListener(JPA 콜백)가 UserIndexedEvent 발행
 * 3. 트랜잭션 커밋 완료 후 이 리스너가 비동기로 호출됨
 * 4. isDelete 여부에 따라 ES 인덱스 문서를 upsert 또는 삭제 처리
 *
 * [@Async 적용 이유]
 * ES HTTP 통신은 수 ms~수십 ms 소요될 수 있음.
 * 별도 스레드 풀에서 처리하여 회원 API 응답 시간에 영향을 주지 않도록 함.
 *
 * [@TransactionalEventListener(phase = AFTER_COMMIT) 적용 이유]
 * 트랜잭션이 롤백되면 이벤트가 실행되지 않으므로
 * DB 롤백 상황에서 ES에 잘못된 데이터가 색인되는 불일치를 방지함.
 * AFTER_COMMIT 시점에만 ES 색인을 실행하여 DB와의 최종 일관성을 보장함.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserIndexEventListener {

    private final UserSearchRepository userSearchRepository;

    /**
     * 트랜잭션 커밋 완료 후 비동기로 호출되어 ES 인덱스를 갱신함.
     *
     * @param event 색인 대상 유저 정보 및 삭제 여부를 담은 이벤트 객체
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleUserIndexedEvent(UserIndexedEvent event) {
        User user = event.getUser();
        String userIdStr = String.valueOf(user.getUserId());
        try {
            if (event.isDelete()) {
                // 회원 삭제 이벤트 → ES 인덱스에서 해당 문서 제거
                userSearchRepository.deleteById(userIdStr);
                log.info("[Elasticsearch] User index deleted: {}", userIdStr);
            } else {
                // 회원 생성/수정 이벤트 → ES 인덱스에 문서 upsert
                UserDocument doc = UserDocument.builder()
                        .id(userIdStr)
                        .email(user.getEmail())
                        .status(user.getStatus())
                        .grade(user.getGrade() != null ? user.getGrade().name() : null)
                        .role(user.getRole() != null ? user.getRole().name() : null)
                        // createdAt 미설정 시 현재 시각을 epoch millis로 대체
                        .createdAt(user.getCreatedAt() != null
                                ? user.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                                : System.currentTimeMillis())
                        .build();
                userSearchRepository.save(doc);
                log.info("[Elasticsearch] User index updated: {}", userIdStr);
            }
        } catch (Exception e) {
            // ES 색인 실패 시 로그만 남기고 메인 트랜잭션에는 영향 없음
            log.error("[Elasticsearch] Failed to index user: {}, error: {}", userIdStr, e.getMessage(), e);
        }
    }
}
