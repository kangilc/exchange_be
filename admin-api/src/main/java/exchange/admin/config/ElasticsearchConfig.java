package exchange.admin.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

/**
 * 엘라스틱서치 연결 설정 클래스.
 * Spring Data Elasticsearch 리포지토리 활성화 및 클라이언트 접속 구성을 담당함.
 */
@Configuration
@EnableElasticsearchRepositories(basePackages = "exchange.admin.repository.es")
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Value("${spring.elasticsearch.uris}")
    private String elasticsearchUri;

    @Override
    public ClientConfiguration clientConfiguration() {
        // 프로토콜 제거 후 호스트와 포트만 바인딩
        String cleanUri = elasticsearchUri.replace("http://", "").replace("https://", "");
        return ClientConfiguration.builder()
                .connectedTo(cleanUri)
                .build();
    }
}
