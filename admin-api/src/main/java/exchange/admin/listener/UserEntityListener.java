package exchange.admin.listener;

import exchange.admin.model.User;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ApplicationEventPublisherAware;
import org.springframework.stereotype.Component;

/**
 * JPA 엔티티 라이프사이클 이벤트를 가로채서 Spring Event를 발행하는 엔티티 리스너 클래스.
 * 회원 생성, 변경, 삭제 발생 시 자동으로 검색엔진 동기화 이벤트를 전파함.
 */
@Component
public class UserEntityListener implements ApplicationEventPublisherAware {

    private static ApplicationEventPublisher eventPublisher;

    @Override
    public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
        UserEntityListener.eventPublisher = applicationEventPublisher;
    }

    @PostPersist
    @PostUpdate
    public void onPostPersistOrUpdate(User user) {
        if (eventPublisher != null) {
            eventPublisher.publishEvent(new UserIndexedEvent(this, user, false));
        }
    }

    @PostRemove
    public void onPostRemove(User user) {
        if (eventPublisher != null) {
            eventPublisher.publishEvent(new UserIndexedEvent(this, user, true));
        }
    }
}
