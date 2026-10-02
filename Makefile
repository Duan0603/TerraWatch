# ========================================================
# GeoSentry / TerraWatch - Developer & Evaluation Makefile
# ========================================================

.PHONY: help up down restart logs ps seed clean test

help:
	@echo "Lệnh điều hành hệ thống GeoSentry Microservices:"
	@echo "  make up       - Khởi động toàn bộ microservices (Docker Compose)"
	@echo "  make down     - Dừng và gỡ bỏ toàn bộ containers"
	@echo "  make restart  - Khởi động lại hệ thống"
	@echo "  make logs     - Xem log thời gian thực của tất cả services"
	@echo "  make ps       - Kiểm tra trạng thái sức khỏe các containers"
	@echo "  make seed     - Nạp lại dữ liệu kiểm thử mẫu PostGIS"
	@echo "  make test     - Chạy kiểm thử tự động các service"
	@echo "  make clean    - Dọn dẹp volumes và cache rác"

up:
	docker compose up -d --build

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

ps:
	docker compose ps

seed:
	docker exec -i terrawatch-postgis psql -U postgres -d terrawatch < database/seed.sql

clean:
	docker compose down -v
