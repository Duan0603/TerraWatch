package vn.terrawatch.core.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("GeoSentry (TerraWatch) Core API")
                .description("National Satellite Landslide Early Warning Core Backend Service (Spring Boot 3 + PostGIS)")
                .version("1.0.0")
                .contact(new Contact()
                    .name("TerraWatch Capstone Team")
                    .email("hoangduan06032005@gmail.com"))
                .license(new License().name("MIT License")));
    }
}
