# Story 1.1: Multi-Role User Registration & Authentication (Register / Login / JWT)

Status: ready-for-dev

## Story Overview
**Story Key:** `1-1-multi-role-user-registration-authentication-register-login-jwt`  
**Epic:** Epic 1: Authentication, RBAC & Landslide Database Foundation (Tuần 1)  
**Target Service:** Core API (`services/core-api/`)  

### User Story
As a User (Citizen, Officer, or Admin),  
I want to register an account and log in securely to receive a role-specific JWT access token,  
So that my identity and authorized operational scope are verified across WebGIS and Mobile applications.

---

## Acceptance Criteria
- [ ] AC1: `POST /api/v1/auth/register` creates a user with default role `citizen` (with optional `phone_number` for SMS alerts). Only `admin` may assign `officer` / `admin` roles. Passwords hashed with BCrypt.
- [ ] AC2: `POST /api/v1/auth/login` validates credentials and returns JWT token containing `userId`, `email`, and `role`.
- [ ] AC3: `GET /api/v1/auth/me` returns current user profile when called with `Authorization: Bearer <token>`.
- [ ] AC4: Spring Security 6 configured to permit public access to `/api/v1/auth/**` while requiring JWT authentication for protected routes.
- [ ] AC5: Passwords are never returned in plaintext in any response.

---

## Technical Context & Guardrails
- **Framework:** Spring Boot 3.x, Spring Security 6.x, `jjwt` (Java JWT) library.
- **Entity:** [User.java](file:///d:/SECapstone/services/core-api/src/main/java/vn/terrawatch/core/entity/User.java) in `core_schema.users`.
- **Security Config:** [SecurityConfig.java](file:///d:/SECapstone/services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java).
- **Supported Roles:** `admin`, `officer`, `citizen` (matches `core_schema.user_role` enum).

---

## Tasks & Subtasks
- [ ] Task 1: Add JWT dependency & JWT Utility Service
  - [ ] 1.1 Verify/add `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` in `services/core-api/pom.xml`.
  - [ ] 1.2 Implement `JwtTokenProvider` / `JwtService` to generate and validate JWT tokens with secret key, subject, and role claims.
- [ ] Task 2: Implement Auth DTOs & Service
  - [ ] 2.1 Create DTOs: `RegisterRequest`, `LoginRequest`, `AuthResponse`, `UserProfileResponse`.
  - [ ] 2.2 Implement `UserRepository` methods: `findByEmail(String email)`, `existsByEmail(String email)`.
  - [ ] 2.3 Implement `AuthService` handling registration, BCrypt password hashing, and authentication validation.
- [ ] Task 3: Implement AuthController & REST Endpoints
  - [ ] 3.1 Create `AuthController` exposing `/api/v1/auth/register`, `/api/v1/auth/login`, and `/api/v1/auth/me`.
  - [ ] 3.2 Update `SecurityConfig.java` to permit `/api/v1/auth/**` and configure `JwtAuthenticationFilter` for protected requests.
- [ ] Task 4: Unit & Integration Verification
  - [ ] 4.1 Test registration with duplicate email (returns 409 Conflict / 400 Bad Request).
  - [ ] 4.2 Test login with correct and incorrect credentials.
  - [ ] 4.3 Test calling `/api/v1/auth/me` with valid JWT header.

---

## Dev Agent Record
### Debug Log
- Story initialized by BMAD Party Mode for the Landslide Early-Warning System.
### Completion Notes
- Ready for developer agent execution via `/bmad-dev-story`.
