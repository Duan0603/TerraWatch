package vn.terrawatch.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtAuthenticationFilter;
import vn.terrawatch.core.security.JwtTokenProvider;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtTokenProvider tokens, UserRepository users) throws Exception {
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
                .addFilterBefore(new JwtAuthenticationFilter(tokens, users), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/google",
                                "/api/v1/auth/officer-requests", "/api/v1/auth/email-exists",
                                "/api/v1/auth/password-reset", "/api/v1/auth/password-reset/check",
                                "/api/v1/auth/password-reset/email/request", "/api/v1/auth/password-reset/email/verify",
                                "/api/v1/auth/password-reset/email/complete")
                        .permitAll()
                        .requestMatchers("/api/v1/auth/me", "/api/v1/auth/me/**", "/api/v1/auth/password")
                        .authenticated()
                        .requestMatchers("/api/v1/alerts/**").authenticated()
                        .requestMatchers("/api/v1/forecasts/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/v1/community-reports",
                                "/api/v1/community-reports/photos")
                        .authenticated()
                        .requestMatchers("/api/v1/community-reports/mine").authenticated()
                        // Story 4.7: the full list carries names, phones and exact GPS of citizens.
                        .requestMatchers(HttpMethod.GET, "/api/v1/community-reports", "/api/v1/community-reports/photos/*")
                        .hasAnyRole("OFFICER", "ADMIN")
                        // Story 4.29: model cards are staff reading.
                        .requestMatchers("/api/v1/model-card").hasAnyRole("OFFICER", "ADMIN")
                        // Story 1.3 review: this diagnostic/circuit-breaker/event-bus test endpoint
                        // became
                        // internet-reachable for the first time once the gateway added a route for it
                        // (previously internal-network-only). Require a valid session (any role) rather
                        // than leaving it in the blanket permitAll below.
                        // Story 4.23: it also lets a caller push events onto the Redis bus, so admin only.
                        .requestMatchers("/api/v1/diagnostic/**").hasRole("ADMIN")
                        // Story 4.23: review of the legacy incident queue is staff work; before this anyone,
                        // signed in or not, could approve or reject an incident (PATCH .../verify).
                        .requestMatchers(HttpMethod.GET, "/api/v1/landslides/queue").hasAnyRole("OFFICER", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/landslides/*/verify").hasAnyRole("OFFICER", "ADMIN")
                        // Errors thrown inside a controller are re-dispatched to /error; without this they
                        // came back as a misleading 401 whenever a controller had no JSON error handler.
                        .requestMatchers("/error").permitAll()
                        // Only the admin-authored broadcast is currently role-gated; other pre-existing
                        // routes stay permitAll below to avoid regressing Stories 4.2/4.3/4.4 (see
                        // story
                        // 1.1's Dev Notes -> Architecture Compliance for why the blanket rule is
                        // untouched).
                        .requestMatchers(HttpMethod.POST, "/api/v1/notifications/broadcast").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/notifications/broadcast/*/revoke").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/v1/notifications/broadcasts",
                                "/api/v1/notifications/broadcast/preview",
                                "/api/v1/notifications/broadcast/*/deliveries")
                        .hasRole("ADMIN")
                        // PRD: chỉ admin quản lý vùng giám sát; GET vẫn công khai cho bản đồ và app
                        .requestMatchers(HttpMethod.POST, "/api/v1/monitoring-areas").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/monitoring-areas/**").hasRole("ADMIN")
                        // Admin user management: duyệt cán bộ, khóa/mở tài khoản, phân quyền
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/**").permitAll()
                        .anyRequest().authenticated());

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
