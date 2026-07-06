package exchange.admin.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;
import org.springframework.data.elasticsearch.annotations.Setting;

/**
 * 엘라스틱서치 검색용 회원 도큐먼트 엔티티.
 * 이메일에 edge_ngram 기반 분석기를 매핑하여 자동완성을 초고속으로 처리함.
 */
@Document(indexName = "users")
@Setting(settingPath = "elasticsearch/settings.json")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDocument {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "autocomplete_analyzer", searchAnalyzer = "autocomplete_search_analyzer")
    private String email;

    @Field(type = FieldType.Keyword)
    private String status;

    @Field(type = FieldType.Keyword)
    private String grade;

    @Field(type = FieldType.Keyword)
    private String role;

    @Field(type = FieldType.Long)
    private Long createdAt;
}
