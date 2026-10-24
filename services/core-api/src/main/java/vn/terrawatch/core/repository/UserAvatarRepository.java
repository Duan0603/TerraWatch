package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.UserAvatar;

import java.util.UUID;

@Repository
public interface UserAvatarRepository extends JpaRepository<UserAvatar, UUID> {}
