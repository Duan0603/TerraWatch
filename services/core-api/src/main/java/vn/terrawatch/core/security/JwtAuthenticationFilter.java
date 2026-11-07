package vn.terrawatch.core.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import vn.terrawatch.core.repository.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenProvider tokens;
    private final UserRepository users;

    public JwtAuthenticationFilter(JwtTokenProvider tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            try {
                var claims = tokens.validateAndParse(header.substring(7));
                String email = claims.get("email", String.class);
                Role role = Role.fromDbValue(claims.get("role", String.class)).orElse(null);
                if (claims.getSubject() == null || claims.getExpiration() == null || email == null || email.isBlank()
                    || role == null) {
                    throw new JwtException("Missing or invalid identity claims");
                }
                // Story 4.7: a token is only as good as the account behind it. Re-read the user so a
                // locked, pending, rejected, deleted or demoted account loses access at once, and
                // authorize with the role stored in the database, not the one frozen in the token.
                UUID userId = UUID.fromString(claims.getSubject());
                var user = users.findById(userId).orElse(null);
                Role currentRole = user == null ? null : Role.fromDbValue(user.getRole()).orElse(null);
                if (user == null || currentRole == null || !user.isActive()
                    || !"approved".equalsIgnoreCase(user.getApprovalStatus())) {
                    throw new JwtException("Account is not allowed to sign in");
                }
                var authentication = UsernamePasswordAuthenticationToken.authenticated(
                    userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + currentRole.name())));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (JwtException | IllegalArgumentException error) {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }
}
