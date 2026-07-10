package exchange.admin.listener;

import exchange.admin.model.User;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 회원 색인 이벤트 데이터를 담는 Spring ApplicationEvent 구현 클래스.
 *
 * UserEntityListener가 JPA 콜백(PostPersist/PostUpdate/PostRemove) 시점에 생성하여 발행하고,
 * UserIndexEventListener가 수신하여 Elasticsearch 색인 처리를 수행함.
 *
 * Spring 이벤트 구조를 사용함으로써 JPA 트랜잭션 완료 시점과
 * ES 색인 처리를 결합도 없이 분리할 수 있음.
 */
@Getter
public class UserIndexedEvent extends ApplicationEvent {

    // 색인 대상 User 엔티티
    private final User user;

    // true → ES 인덱스에서 문서 삭제, false → ES 인덱스에 문서 저장(upsert)
    private final boolean isDelete;

    /**
     * @param source   이벤트를 발행한 객체 (UserEntityListener 인스턴스)
     * @param user     색인 대상 User 엔티티
     * @param isDelete 삭제 이벤트 여부 (true: 삭제, false: 생성/수정)
     */
    public UserIndexedEvent(Object source, User user, boolean isDelete) {
        super(source);
        this.user = user;
        this.isDelete = isDelete;
    }
}
