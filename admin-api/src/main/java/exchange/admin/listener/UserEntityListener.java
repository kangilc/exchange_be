package exchange.admin.listener;

import exchange.admin.model.User;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.stereotype.Component;

/**
 * JPA 엔티티 라이프사이클 이벤트를 가로채서 Spring Event를 발행하는 엔티티 리스너.
 *
 * User 엔티티에 @EntityListeners(UserEntityListener.class)로 등록되면,
 * JPA가 INSERT/UPDATE/DELETE 완료 직후 이 클래스의 콜백 메서드를 자동 호출함.
 * 콜백에서는 Elasticsearch 색인 동기화를 위한 Spring 이벤트를 발행함.
 *
 * ApplicationEventPublisherAware 구현 이유:
 * JPA 엔티티 리스너는 Spring 컨테이너가 직접 생성하지 않으므로
 * @Autowired로 ApplicationEventPublisher를 주입받을 수 없음.
 * static 필드에 보관하여 Spring 컨텍스트와 연결하는 우회 방식을 사용함.
 */
@Component
public class UserEntityListener implements ApplicationEventPublisherAware {

    // JPA 리스너 인스턴스는 Spring Bean이 아니므로 static으로 보관
    private static ApplicationEventPublisher eventPublisher;

    /**
     * Spring 컨텍스트 초기화 시 자동 호출되어 이벤트 발행기를 static 필드에 주입함.
     * 이후 JPA 콜백에서 eventPublisher를 통해 이벤트를 발행할 수 있게 됨.
     */
    @Override
    public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        UserEntityListener.eventPublisher = applicationEventPublisher;
    }

    /**
     * User 엔티티가 새로 INSERT(PostPersist) 또는 UPDATE(PostUpdate)된 직후 호출됨.
     * isDelete=false로 UserIndexedEvent를 발행하여 ES 인덱스 갱신(upsert)을 트리거함.
     *
     * @param user INSERT 또는 UPDATE된 User 엔티티
     */
    @PostPersist
    @PostUpdate
    public void onPostPersistOrUpdate(User user) {
        if (eventPublisher != null) {
            // isDelete=false → ES에서 해당 유저 문서를 저장(upsert) 처리
            eventPublisher.publishEvent(new UserIndexedEvent(this, user, false));
        }
    }

    /**
     * User 엔티티가 DELETE된 직후 호출됨.
     * isDelete=true로 UserIndexedEvent를 발행하여 ES 인덱스에서 해당 문서 삭제를 트리거함.
     *
     * @param user DELETE된 User 엔티티
     */
    @PostRemove
    public void onPostRemove(User user) {
        if (eventPublisher != null) {
            // isDelete=true → ES에서 해당 유저 문서를 삭제 처리
            eventPublisher.publishEvent(new UserIndexedEvent(this, user, true));
        }
    }
}
