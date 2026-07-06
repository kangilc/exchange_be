package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.dto.response.UserAutocompleteODT;
import exchange.admin.dto.response.UserSearchODT;
import exchange.admin.service.UserSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 엘라스틱서치를 이용한 회원 검색 및 자동완성 제공 컨트롤러 클래스.
 */
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class UserSearchController {

    private final UserSearchService userSearchService;

    /**
     * 회원의 이메일을 검색하여 일치하는 회원 정보를 반환합니다.
     *
     * @param keyword 검색 키워드
     * @return ApiResponse wrapped list of UserSearchODT
     */
    @GetMapping("/search")
    public ApiResponse<List<UserSearchODT>> searchUsers(
            @RequestParam(name = "keyword", required = false) String keyword) {
        List<UserSearchODT> results = userSearchService.searchUsers(keyword);
        return ApiResponse.success(results);
    }

    /**
     * 입력된 접두사 기준 자동완성 이메일 추천 단어를 반환합니다.
     *
     * @param prefix 자동완성 접두사
     * @return ApiResponse wrapped list of UserAutocompleteODT
     */
    @GetMapping("/autocomplete")
    public ApiResponse<List<UserAutocompleteODT>> autocomplete(@RequestParam(name = "prefix") String prefix) {
        List<UserAutocompleteODT> results = userSearchService.autocomplete(prefix);
        return ApiResponse.success(results);
    }
}
