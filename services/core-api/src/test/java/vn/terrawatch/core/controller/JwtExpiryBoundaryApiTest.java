package vn.terrawatch.core.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import vn.terrawatch.core.security.JwtTokenProvider;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Token life edge (BL-AUTH-012/013) through the real filter chain. BL-AUTH-013 (a token one minute past its end is a 401) is
 * already asserted by AuthControllerTest and AuthorizationMatrixTest; the accepted side of the edge was not.
 */
class JwtExpiryBoundaryApiTest extends FlowTestBase {
    @Value("${jwt.secret}") String secret;

    @Test
    void aTokenWithOneMinuteLeftIsAcceptedAndOneThatEndedASecondAgoIsRefused() throws Exception {
        Acct user = account("citizen");
        // BL-AUTH-012: a token that still has 60 seconds to live works on a protected route and names its owner
        String oneMinuteLeft = new JwtTokenProvider(secret, 60_000).generateToken(user.user());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + oneMinuteLeft))
            .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(user.id().toString()));
        // the other side of the edge: the same token, ended 1 second ago
        String justEnded = new JwtTokenProvider(secret, -1_000).generateToken(user.user());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + justEnded)).andExpect(status().isUnauthorized());
    }
}
