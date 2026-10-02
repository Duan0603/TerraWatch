package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.LandslideEvent;

import java.util.List;
import java.util.UUID;

@Repository
public interface LandslideEventJpaRepository extends JpaRepository<LandslideEvent, UUID> {

    List<LandslideEvent> findByStatusOrderByDetectionDateDesc(String status);

    List<LandslideEvent> findByRiskLevel(String riskLevel);

    long countByStatus(String status);

    @Query(value = "SELECT COUNT(*) FROM landslide_events WHERE status = 'verified' AND risk_level = 'extreme'", nativeQuery = true)
    long countExtremeVerifiedEvents();
}
