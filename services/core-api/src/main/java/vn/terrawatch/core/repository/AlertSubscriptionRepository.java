package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.AlertSubscription;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AlertSubscriptionRepository extends JpaRepository<AlertSubscription, UUID> {
    List<AlertSubscription> findByUserIdAndActiveTrueOrderBySubscribedAtDesc(UUID userId);

    Optional<AlertSubscription> findByUserIdAndAreaId(UUID userId, Integer areaId);

    Optional<AlertSubscription> findBySubscriptionIdAndUserId(UUID subscriptionId, UUID userId);
}
