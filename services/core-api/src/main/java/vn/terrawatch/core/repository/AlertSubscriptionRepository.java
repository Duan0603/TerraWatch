package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.entity.AlertSubscription;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AlertSubscriptionRepository extends JpaRepository<AlertSubscription, UUID> {
    List<AlertSubscription> findByUserIdAndActiveTrueOrderBySubscribedAtDesc(UUID userId);

    Optional<AlertSubscription> findByUserIdAndAreaId(UUID userId, Integer areaId);

    Optional<AlertSubscription> findBySubscriptionIdAndUserId(UUID subscriptionId, UUID userId);

    /** Subscribe a new citizen to every active monitoring area in one shot. */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms, is_active)
            SELECT :userId, area_id, true, true, true
            FROM gis_schema.monitoring_areas
            WHERE is_active = true
            ON CONFLICT (user_id, area_id) WHERE area_id IS NOT NULL
            DO UPDATE SET is_active = true
            """, nativeQuery = true)
    void autoSubscribeToAllActiveAreas(@Param("userId") UUID userId);
}
