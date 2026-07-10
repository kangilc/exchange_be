package exchange.admin.listener;

import exchange.admin.document.UserDocument;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.repository.es.UserSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 애플리케이션 시작 시 DB의 전체 유저 데이터를 Elasticsearch에 벌크 동기화하는 이니셜라이저.
 *
 * [필요한 이유]
 * docker compose down -v 등으로 ES 볼륨이 초기화되면 ES 인덱스가 비어있게 됨.
 * DB에는 유저 데이터가 존재하지만 ES에 없으면 검색 기능이 동작하지 않으므로,
 * 앱 시작 시점에 DB → ES 전체 동기화를 1회 수행하여 색인 공백 상태를 방지함.
 *
 * [동작 방식]
 * 1. DB에서 전체 User 목록을 조회(findAll)
 * 2. UserDocument 리스트로 변환
 * 3. ES에 saveAll로 벌크 색인
 *
 * [@Profile("local", "dev") 적용 이유]
 * 프로덕션 환경에서는 ES 볼륨을 유지하므로 재색인이 불필요함.
 * 개발/로컬 환경에서만 동작하도록 제한함.
 *
 * [메모리 특성]
 * findAll()로 전체 유저를 힙에 로드하므로 유저 수에 비례하여 메모리를 사용함.
 * run() 메서드 종료 후 GC 대상이 되어 메모리가 반환됨 (일시적 점유).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Profile({"local", "dev"})
public class ElasticsearchIndexInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final UserSearchRepository userSearchRepository;

    /**
     * Spring Boot 기동 완료 후 자동 호출됨 (CommandLineRunner 구현).
     * DB 전체 유저를 ES에 벌크 색인하여 검색 인덱스를 초기화함.
     */
    @Override
    public void run(String... args) {
        log.info("[Elasticsearch] Starting full user index sync from DB...");
        try {
            // DB 전체 유저 조회 (run() 종료 시 GC 대상으로 메모리 반환됨)
            List<User> users = userRepository.findAll();

            // User 엔티티 → UserDocument 변환 (ES 색인용 문서 형식)
            List<UserDocument> docs = users.stream().map(user -> {
                String userIdStr = String.valueOf(user.getUserId());
                return UserDocument.builder()
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
            }).collect(Collectors.toList());

            if (!docs.isEmpty()) {
                // ES 벌크 색인 실행 (개별 save보다 성능 효율적)
                userSearchRepository.saveAll(docs);
                log.info("[Elasticsearch] Full user index sync completed! Synced {} users.", docs.size());
            } else {
                log.info("[Elasticsearch] No user found in DB to sync.");
            }
        } catch (Exception e) {
            // 색인 실패 시 앱 구동을 중단하지 않고 로그만 남김
            log.error("[Elasticsearch] Failed to run full user index sync", e);
        }
    }
}
