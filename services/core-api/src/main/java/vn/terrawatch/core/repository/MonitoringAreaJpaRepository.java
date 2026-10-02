package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.MonitoringArea;

import java.util.List;

@Repository
public interface MonitoringAreaJpaRepository extends JpaRepository<MonitoringArea, Integer> {

    List<MonitoringArea> findByIsActiveTrue();
}
