# Local/demo use only (Story 5.1): sends an emergency broadcast through the real API so a phone receives a push.
# Creates (once) a demo admin account, promotes it, logs in and calls POST /api/v1/notifications/broadcast.
# Run from the repository root:   ./services/core-api/scripts/send-test-broadcast.ps1 -AreaId 1
# Needs: the stack running (docker compose up), the phone logged in, subscribed to that area, and
# secrets/firebase-service-account.json in place (otherwise the result says "FCM not configured").
param(
    [int]$AreaId = 1,
    [ValidateSet("low", "medium", "high", "extreme")][string]$Level = "high",
    [string]$Message = "Canh bao thu nghiem: co nguy co sat lo dat, hay roi khoi khu vuc nguy hiem."
)

$base = "http://localhost:8080/api/v1"
$email = "demo.broadcaster@terrawatch.vn"
$password = "TerraWatch@2026"

function Send-Json($method, $path, $body, $token) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
    Invoke-RestMethod -Method $method -Uri "$base$path" -ContentType "application/json; charset=utf-8" -Body $bytes -Headers $headers
}

try { Send-Json Post "/auth/register" @{ fullName = "Demo Broadcaster"; email = $email; password = $password } $null | Out-Null } catch { }
docker exec terrawatch-postgis psql -U postgres -d terrawatch -c "UPDATE core_schema.users SET role = 'admin' WHERE email = '$email'" | Out-Null
$token = (Send-Json Post "/auth/login" @{ email = $email; password = $password } $null).token

$result = Send-Json Post "/notifications/broadcast" @{ riskLevel = $Level; areaId = $AreaId; message = $Message } $token
$result | ConvertTo-Json -Depth 5
if ($result.status -eq "NO_RECIPIENTS") { Write-Host "Khong co ai nhan: kiem tra dien thoai da dang nhap, da dang ky vung $AreaId (Push) va da dang ky thiet bi." }
if ($result.status -eq "FAILED") { Write-Host "Khong gui duoc: $($result.first_error)" }
