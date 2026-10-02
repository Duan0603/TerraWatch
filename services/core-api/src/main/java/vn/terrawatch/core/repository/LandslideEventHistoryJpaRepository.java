package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.LandslideEventHistory;

import java.util.List;
import java.util.UUID;

@Repository
public interface LandslideEventHistoryJpaRepository extends JpaRepository<LandslideEventHistory, Integer> {

    List<LandslideEventHistory> findByEventIdOrderByChangedAtDesc(UUID eventId);
}
