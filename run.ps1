# ==============================================================================
# GeoSentry / TerraWatch - Windows PowerShell Quick Runner
# Usage: .\run.ps1 <command>
# ==============================================================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

switch ($Command.ToLower()) {
    "up" {
        Write-Host "Starting all 7 GeoSentry services..." -ForegroundColor Green
        docker compose up -d --build
    }
    "down" {
        Write-Host "Stopping all containers..." -ForegroundColor Yellow
        docker compose down
    }
    "restart" {
        Write-Host "Restarting system..." -ForegroundColor Yellow
        docker compose down
        docker compose up -d --build
    }
    "logs" {
        docker compose logs -f
    }
    "ps" {
        docker compose ps
    }
    "clean" {
        Write-Host "Removing containers and database volumes to reset fresh..." -ForegroundColor Red
        docker compose down -v
    }
    "rebuild-core" {
        Write-Host "Rebuilding Core API..." -ForegroundColor Cyan
        docker compose up -d --build core-api
    }
    "rebuild-ai" {
        Write-Host "Rebuilding AI Service..." -ForegroundColor Cyan
        docker compose up -d --build ai-service
    }
    "rebuild-gis" {
        Write-Host "Rebuilding GIS Service..." -ForegroundColor Cyan
        docker compose up -d --build gis-service
    }
    "rebuild-web" {
        Write-Host "Rebuilding WebGIS..." -ForegroundColor Cyan
        docker compose up -d --build webgis
    }
    "rebuild-gateway" {
        Write-Host "Rebuilding API Gateway..." -ForegroundColor Cyan
        docker compose up -d --build gateway
    }
    "migrate" {
        python scripts/migrate.py up
    }
    "db-status" {
        python scripts/migrate.py status
    }
    default {
        Write-Host ""
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "  GEOSENTRY (TERRAWATCH) - POWERSHELL QUICK COMMANDS" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "  .\run.ps1 up              - Start all 7 services" -ForegroundColor White
        Write-Host "  .\run.ps1 down            - Stop all services" -ForegroundColor White
        Write-Host "  .\run.ps1 restart         - Restart system" -ForegroundColor White
        Write-Host "  .\run.ps1 logs            - View live system logs" -ForegroundColor White
        Write-Host "  .\run.ps1 ps              - Check containers health status" -ForegroundColor White
        Write-Host "  .\run.ps1 clean           - Clean DB volumes to reset fresh" -ForegroundColor White
        Write-Host ""
        Write-Host "  --- Rebuild single service (5-10s) ---" -ForegroundColor Yellow
        Write-Host "  .\run.ps1 rebuild-core    - Rebuild Core API" -ForegroundColor White
        Write-Host "  .\run.ps1 rebuild-ai      - Rebuild AI Service" -ForegroundColor White
        Write-Host "  .\run.ps1 rebuild-gis     - Rebuild GIS Service" -ForegroundColor White
        Write-Host "  .\run.ps1 rebuild-web     - Rebuild WebGIS" -ForegroundColor White
        Write-Host "  .\run.ps1 rebuild-gateway - Rebuild API Gateway" -ForegroundColor White
        Write-Host ""
        Write-Host "  --- Database Migration ---" -ForegroundColor Yellow
        Write-Host "  .\run.ps1 migrate         - Apply pending migrations" -ForegroundColor White
        Write-Host "  .\run.ps1 db-status       - View migration status" -ForegroundColor White
        Write-Host "==========================================================" -ForegroundColor Cyan
    }
}
