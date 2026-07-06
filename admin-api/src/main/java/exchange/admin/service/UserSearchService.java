package exchange.admin.service;

import exchange.admin.document.UserDocument;
import exchange.admin.dto.response.UserAutocompleteODT;
import exchange.admin.dto.response.UserSearchODT;
import exchange.admin.repository.es.UserSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 엘라스틱서치를 이용한 회원 검색 및 자동완성 비즈니스 서비스 클래스.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserSearchService {

    private final UserSearchRepository userSearchRepository;

    /**
     * 회원의 이메일을 검색하여 복합 검색 결과를 반환합니다.
     *
     * @param keyword 검색 키워드
     * @return 검색된 회원 ODT 리스트
     */
    public List<UserSearchODT> searchUsers(String keyword) {
        log.info("[Elasticsearch] Searching users with keyword: {}", keyword);
        List<UserDocument> documents;
        if (keyword == null || keyword.trim().isEmpty()) {
            documents = java.util.stream.StreamSupport
                    .stream(userSearchRepository.findAll().spliterator(), false)
                    .collect(Collectors.toList());
        } else {
            // 이메일 키워드 검색 시 edge_ngram 분석기를 올바르게 타는 Match Query 메소드를 사용함.
            documents = userSearchRepository.findByEmail(keyword.trim().toLowerCase());
        }

        return documents.stream().map(doc -> UserSearchODT.builder()
                .userId(Long.parseLong(doc.getId()))
                .email(doc.getEmail())
                .status(doc.getStatus())
                .grade(doc.getGrade())
                .role(doc.getRole())
                .createdAt(doc.getCreatedAt())
                .build()).collect(Collectors.toList());
    }

    /**
     * 입력 키워드 기준 자동완성 목록을 최대 10개 추출합니다.
     *
     * @param prefix 자동완성 접두사
     * @return 추천 이메일 ODT 리스트
     */
    public List<UserAutocompleteODT> autocomplete(String prefix) {
        log.info("[Elasticsearch] Autocomplete prefix: {}", prefix);
        if (prefix == null || prefix.trim().isEmpty()) {
            return List.of();
        }

        // 자동완성 추천 시에도 동일하게 검색 분석 매치 쿼리를 사용함.
        List<UserDocument> documents = userSearchRepository.findByEmail(prefix.trim().toLowerCase());
        return documents.stream()
                .map(doc -> UserAutocompleteODT.builder().email(doc.getEmail()).build())
                .limit(10)
                .collect(Collectors.toList());
    }
}
