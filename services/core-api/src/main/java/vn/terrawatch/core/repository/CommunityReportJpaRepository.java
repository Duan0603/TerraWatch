package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.CommunityReport;

import java.util.List;

@Repository
public interface CommunityReportJpaRepository extends JpaRepository<CommunityReport, Integer> {

    List<CommunityReport> findAllByOrderByReportTimeDesc();

    List<CommunityReport> findByStatus(String status);
}
