# ============================================================
# TerraWatch - Script chay test toan du an
# Dieu kien: Docker Desktop dang chay
# Su dung: .\run-tests.ps1
# ============================================================

$ErrorActionPreference = "Continue"

# --- Paths ---
$JAVA_HOME_PATH = "$env:USERPROFILE\tools\jdk17\jdk-17.0.13+11"
$MVN = "$env:USERPROFILE\tools\apache-maven-3.9.16\bin\mvn.cmd"
$DB_URL_PY = "postgresql://postgres:postgrespassword@127.0.0.1:5432/terrawatch"
$DB_URL_JAVA = "jdbc:postgresql://127.0.0.1:5432/terrawatch"
$ROOT = $PSScriptRoot

$passed = 0
$failed = 0

function Show-Header($title) {
    Write-Host "`n============================================" -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

# ---- KIEM TRA DOCKER ----
Show-Header "Kiem tra Docker"
$pgStatus = docker inspect --format "{{.State.Running}}" terrawatch-postgis 2>&1
if ($pgStatus -ne "true") {
    Write-Host "[WARN] postgres chua chay -> khoi dong..." -ForegroundColor Yellow
    docker compose -f "$ROOT\docker-compose.yml" up -d postgres redis 2>&1 | Out-Null
    Start-Sleep -Seconds 5
}
Write-Host "[OK] PostgreSQL dang chay" -ForegroundColor Green

# ---- AI SERVICE ----
Show-Header "AI Service (Python / ONNX)"
Set-Location "$ROOT\services\ai-service"
$aiResult = python -m unittest discover -s tests -t . 2>&1
$aiResult | Select-Object -Last 5
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] AI Service" -ForegroundColor Green; $passed++
} else {
    Write-Host "[FAIL] AI Service" -ForegroundColor Red; $failed++
}

# ---- GIS SERVICE ----
Show-Header "GIS Service (Python / PostGIS)"
Set-Location "$ROOT\services\gis-service"
$env:DATABASE_URL = $DB_URL_PY
$gisResult = python tests/run_tests.py 2>&1
$gisResult | Select-Object -Last 5
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] GIS Service" -ForegroundColor Green; $passed++
} else {
    Write-Host "[FAIL] GIS Service" -ForegroundColor Red; $failed++
}

# ---- CORE API ----
Show-Header "Core API (Spring Boot / Maven)"
$env:JAVA_HOME = $JAVA_HOME_PATH
Set-Location "$ROOT\services\core-api"
& $MVN "test" `
    "-Dspring.datasource.url=$DB_URL_JAVA" `
    "-Dspring.datasource.password=postgrespassword" `
    "-q" 2>&1 | Select-Object -Last 15
if ($LASTEXITCODE -eq 0) {
    Write-Host "[PASS] Core API" -ForegroundColor Green; $passed++
} else {
    Write-Host "[FAIL] Core API" -ForegroundColor Red; $failed++
}

# ---- KET QUA TONG HOP ----
Show-Header "KET QUA TONG HOP"
Write-Host "  PASS: $passed / $($passed + $failed) service(s)" -ForegroundColor $(if ($failed -eq 0) {"Green"} else {"Yellow"})
if ($failed -gt 0) {
    Write-Host "  FAIL: $failed service(s)" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  Tat ca test deu PASS!" -ForegroundColor Green
    exit 0
}
