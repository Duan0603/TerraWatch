package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.entity.ReportPhoto;

import java.util.UUID;

@Repository
public interface ReportPhotoRepository extends JpaRepository<ReportPhoto, UUID> {}
