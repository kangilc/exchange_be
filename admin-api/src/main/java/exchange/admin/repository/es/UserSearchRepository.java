package exchange.admin.repository.es;

import exchange.admin.document.UserDocument;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 회원 검색 및 자동완성 쿼리 실행을 담당하는 엘라스틱서치 전용 리포지토리 인터페이스.
 */
@Repository
public interface UserSearchRepository extends ElasticsearchRepository<UserDocument, String> {
    List<UserDocument> findByEmailContaining(String email);

    List<UserDocument> findByEmailStartingWith(String prefix);

    // 이메일 필드에 대해 Match Query를 실행하며, 모든 토큰이 부합하도록 AND 연산자를 적용함.
    @org.springframework.data.elasticsearch.annotations.Query("{\"match\": {\"email\": {\"query\": \"?0\", \"operator\": \"and\"}}}")
    List<UserDocument> findByEmail(String email);
}
