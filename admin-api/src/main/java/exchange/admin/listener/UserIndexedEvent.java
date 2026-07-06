package exchange.admin.listener;

import exchange.admin.model.User;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 회원 색인(추가, 수정, 삭제) 이벤트를 운반하는 Spring ApplicationEvent 정의 클래스.
 */
@Getter
public class UserIndexedEvent extends ApplicationEvent {
    private final User user;
    private final boolean isDelete;

    public UserIndexedEvent(Object source, User user, boolean isDelete) {
        super(source);
        this.user = user;
        this.isDelete = isDelete;
    }
}
