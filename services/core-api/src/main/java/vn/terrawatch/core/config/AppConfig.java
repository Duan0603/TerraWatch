package vn.terrawatch.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(30).toMillis());
        return new RestTemplate(factory);
    }

    // a JSON number is not a boolean: isActive:7 must be a 400, not "true"
    @Bean
    public org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer strictBooleans() {
        return b -> b.postConfigurer(m -> m.coercionConfigFor(com.fasterxml.jackson.databind.type.LogicalType.Boolean)
            .setCoercion(com.fasterxml.jackson.databind.cfg.CoercionInputShape.Integer, com.fasterxml.jackson.databind.cfg.CoercionAction.Fail));
    }
}
