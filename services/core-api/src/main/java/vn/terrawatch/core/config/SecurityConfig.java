package vn.terrawatch.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import vn.terrawatch.core.security.JwtAuthenticationFilter;
import vn.terrawatch.core.security.JwtTokenProvider;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtTokenProvider tokens) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Unauthorized\"}");
                })
                .accessDeniedHandler((request, response, exception) -> {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Forbidden\"}");
                }))
            .addFilterBefore(new JwtAuthenticationFilter(tokens), UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/google").permitAll()
                .requestMatchers("/api/v1/auth/me", "/api/v1/auth/me/**", "/api/v1/auth/password").authenticated()
                .requestMatchers("/api/v1/alerts/**").authenticated()
                .requestMatchers("/api/v1/forecasts/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/v1/community-reports", "/api/v1/community-reports/photos").authenticated()
                .requestMatchers("/api/v1/community-reports/mine").authenticated()
                // Story 1.3 review: this diagnostic/circuit-breaker/event-bus test endpoint became
                // internet-reachable for the first time once the gateway added a route for it
                // (previously internal-network-only). Require a valid session (any role) rather
                // than leaving it in the blanket permitAll below.
                .requestMatchers("/api/v1/diagnostic/**").authenticated()
                // Only the admin-authored broadcast is currently role-gated; other pre-existing
                // routes stay permitAll below to avoid regressing Stories 4.2/4.3/4.4 (see story
                // 1.1's Dev Notes -> Architecture Compliance for why the blanket rule is untouched).
                .requestMatchers(HttpMethod.POST, "/api/v1/notifications/broadcast", "/api/v1/notifications/broadcast/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/**").permitAll()
                .anyRequest().authenticated()
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
