package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.terrawatch.core.entity.ForecastReview;

import java.util.UUID;

public interface ForecastReviewJpaRepository extends JpaRepository<ForecastReview, Integer> {
}

