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
 * 애플리케이션 시작 시 DB의 전체 유저 데이터를 엘라스틱서치에 동기화(벌크 색인)하는 이니셜라이저.
 * 로컬 및 개발 환경에서 동작함.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Profile({"local", "dev"})
public class ElasticsearchIndexInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final UserSearchRepository userSearchRepository;

    @Override
    public void run(String... args) {
        log.info("[Elasticsearch] Starting full user index sync from DB...");
        try {
            List<User> users = userRepository.findAll();
            List<UserDocument> docs = users.stream().map(user -> {
                String userIdStr = String.valueOf(user.getUserId());
                return UserDocument.builder()
                        .id(userIdStr)
                        .email(user.getEmail())
                        .status(user.getStatus())
                        .grade(user.getGrade() != null ? user.getGrade().name() : null)
                        .role(user.getRole() != null ? user.getRole().name() : null)
                        .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() : System.currentTimeMillis())
                        .build();
            }).collect(Collectors.toList());

            if (!docs.isEmpty()) {
                userSearchRepository.saveAll(docs);
                log.info("[Elasticsearch] Full user index sync completed! Synced {} users.", docs.size());
            } else {
                log.info("[Elasticsearch] No user found in DB to sync.");
            }
        } catch (Exception e) {
            log.error("[Elasticsearch] Failed to run full user index sync", e);
        }
    }
}
