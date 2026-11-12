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
    "demo-seed" {
        # Local demo data on the named Lao Cai units (Story 5.4). Needs the stack running (.\run.ps1 up).
        # Order matters: rainfall must be stored before the forecast runs are issued, or the evidence panel is empty.
        # SQL goes through a UTF-8 file + docker cp: piping a string to docker in PS 5.1 turns Vietnamese names into '?'.
        function Invoke-DemoSql([string]$sql) {
            $tmp = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllText($tmp, $sql, (New-Object System.Text.UTF8Encoding $false))
            docker cp $tmp terrawatch-postgis:/tmp/demo-seed.sql | Out-Null
            docker exec terrawatch-postgis psql -U postgres -d terrawatch -q -v ON_ERROR_STOP=1 -f /tmp/demo-seed.sql
            $code = $LASTEXITCODE
            Remove-Item $tmp
            if ($code -ne 0) { Write-Host "SQL step failed." -ForegroundColor Red; exit 1 }
        }
        $gis = 'http://127.0.0.1:8002/api/v1/gis'
        # Only the unit INSERT: the fixture's rainfall/forecast rows are fixed to 2026-10-14 and labelled OPEN_METEO without being fetched.
        $fixture = Get-Content database/seed_v3_fixtures.sql -Raw -Encoding UTF8
        $units = [regex]::Match($fixture, '(?s)INSERT INTO gis_schema\.spatial_assessment_units.*?ON CONFLICT \(unit_id\) DO NOTHING;').Value
        if (-not $units) { Write-Host "Unit INSERT not found in database/seed_v3_fixtures.sql" -ForegroundColor Red; exit 1 }
        $ids = @([regex]::Matches($units, "\('(VN_LC_\w+)'") | ForEach-Object { $_.Groups[1].Value })

        Write-Host "1/4 Loading $($ids.Count) Lao Cai assessment units..." -ForegroundColor Cyan
        Invoke-DemoSql $units

        Write-Host "2/4 Extracting DEM terrain (Open-Meteo elevation)..." -ForegroundColor Cyan
        $terrain = Invoke-RestMethod -Method Post -Uri "$gis/terrain/extract" -ContentType 'application/json' -Body (@{ unit_ids = $ids } | ConvertTo-Json)
        $fallback = @($terrain.units | Where-Object { $_.dem_source -ne 'COPERNICUS_GLO_30' })
        if ($fallback.Count -gt 0) {
            Write-Host "   WARNING: $($fallback.Count) unit(s) got FALLBACK_SYNTHETIC terrain (DEM fetch failed). Re-run when online." -ForegroundColor Yellow
        }

        Write-Host "3/4 Ingesting as-of rainfall for area 2..." -ForegroundColor Cyan
        $rain = Invoke-RestMethod -Method Post -Uri "$gis/rainfall/ingest" -ContentType 'application/json' -Body '{"area_id":2,"past_days":7,"forecast_days":2}'
        $failed = @($rain.results | Where-Object { $_.status -ne 'success' })
        if ($failed.Count -gt 0) { Write-Host "   WARNING: rainfall failed for $($failed.Count) unit(s)." -ForegroundColor Yellow }

        Write-Host "4/4 Creating demo forecast runs (valid 24 h)..." -ForegroundColor Cyan
        Invoke-DemoSql (Get-Content services/core-api/scripts/seed-demo-lao-cai.sql -Raw -Encoding UTF8)
        Write-Host "Done. Live rain and GRU for these units appear within about a minute." -ForegroundColor Green
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
        Write-Host "  .\run.ps1 demo-seed       - Demo data: named Lao Cai units + 24h demo forecasts" -ForegroundColor White
        Write-Host "==========================================================" -ForegroundColor Cyan
    }
}
