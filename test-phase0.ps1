# =====================================================
# TRAIL Game Pro 3.2 - Phase 0 Integration Test  v4
# =====================================================
$BASE = "https://trail-game-pro-3-2.onrender.com"
$ADMIN_EMAIL = "tanq.trail@gmail.com"
$ADMIN_PASS  = "TNQkiyo181"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$pass = 0; $fail = 0
function OK($label) { Write-Host "  [OK] $label" -ForegroundColor Green;  $script:pass++ }
function NG($label, $err) { Write-Host "  [NG] $label : $err" -ForegroundColor Red; $script:fail++ }
function Section($title) { Write-Host ""; Write-Host "--- $title ---" -ForegroundColor Cyan }
function Api($method, $path, $body=$null, $token=$null) {
    $h = @{ "Content-Type"="application/json" }
    if ($token) { $h["Authorization"] = "Bearer $token" }
    $p = @{ Method=$method; Uri="$BASE/api$path"; Headers=$h; ErrorAction="Stop" }
    if ($body) { $p["Body"] = ($body | ConvertTo-Json -Depth 5) }
    return Invoke-RestMethod @p
}

Write-Host ""
Write-Host "TRAIL Game Pro 3.2 - Phase 0 Integration Test v4" -ForegroundColor Magenta
Write-Host "Target: $BASE"

# -------------------------------------------------------
Section "1. Health Check"
try {
    $r = Invoke-WebRequest -Uri "$BASE/health" -UseBasicParsing -ErrorAction Stop
    if ($r.StatusCode -eq 200) { OK "GET /health -> HTTP 200" }
    else { NG "GET /health" "HTTP $($r.StatusCode)" }
} catch { NG "GET /health" $_.Exception.Message }

# -------------------------------------------------------
Section "2. Admin Auth"
$token=$null; $tenantId=$null; $tenantSlug=$null
try {
    $r = Api "POST" "/auth/admin/login" @{ email=$ADMIN_EMAIL; password=$ADMIN_PASS }
    $token=$r.token; $tenantId=$r.tenant.id; $tenantSlug=$r.tenant.slug
    if ($token) { OK "POST /auth/admin/login -> token OK (tenant=$tenantSlug id=$tenantId)" }
    else { NG "POST /auth/admin/login" "no token" }
} catch { NG "POST /auth/admin/login" $_.Exception.Message }
if (-not $token) { Write-Host "AUTH FAILED - stopping." -ForegroundColor Red; exit 1 }

# -------------------------------------------------------
Section "3. Play Sessions (0-5) - get valid IDs first"
$studentId=$null; $gameId=$null
# Try to get a student from the tenant
try {
    $r = Api "GET" "/t/$tenantSlug/students" $null $token
    # Try different response shapes
    if ($r.students) { $studentId = $r.students[0].id }
    elseif ($r -is [array]) { $studentId = $r[0].id }
    if ($studentId) { Write-Host "  [INFO] Using student_id=$studentId" -ForegroundColor Yellow }
} catch {}

# Try to get a game
try {
    $r = Api "GET" "/t/$tenantSlug/games" $null $token
    if ($r.games) { $gameId = $r.games[0].id }
    elseif ($r -is [array]) { $gameId = $r[0].id }
    if ($gameId) { Write-Host "  [INFO] Using game_id=$gameId" -ForegroundColor Yellow }
} catch {}

# Use fallbacks
if (-not $studentId) { $studentId = 1 }
if (-not $gameId)    { $gameId = 1 }

$sessionId = $null
try {
    $r = Api "POST" "/play-sessions/start" @{
        tenant_id=$tenantId; student_id=$studentId; game_id=$gameId
    } $token
    $sessionId = $r.session_id
    if ($sessionId) { OK "POST /play-sessions/start -> session_id=$sessionId" }
    else { NG "POST /play-sessions/start" "no session_id. Response: $($r | ConvertTo-Json -Compress)" }
} catch { NG "POST /play-sessions/start" $_.Exception.Message }

if ($sessionId) {
    Start-Sleep -Milliseconds 300
    try {
        $r = Api "PATCH" "/play-sessions/$sessionId/end" @{
            score=800; correct_count=8; total_count=10
        } $token
        if ($r.alt -ne $null) { OK "PATCH /play-sessions/$sessionId/end -> ALT=$($r.alt.total)" }
        else { NG "PATCH /play-sessions/end" "no alt field. Response: $($r | ConvertTo-Json -Compress)" }
    } catch { NG "PATCH /play-sessions/end" $_.Exception.Message }
}

# -------------------------------------------------------
Section "4. Streaks (0-4)"
try {
    $r = Api "GET" ("/streaks/$studentId`?tenant_id=" + $tenantId) $null $token
    $raw = $r | ConvertTo-Json -Compress
    if ($r.streak) {
        OK "GET /streaks/$studentId -> current=$($r.streak.current) max=$($r.streak.max)"
    } elseif ($r.current_streak -ne $null) {
        OK "GET /streaks/$studentId -> current_streak=$($r.current_streak)"
    } else {
        NG "GET /streaks/$studentId" "unexpected: $raw"
    }
} catch { NG "GET /streaks/$studentId" $_.Exception.Message }

# -------------------------------------------------------
Section "5. Questions CRUD (0-6)"
$qId = [System.Guid]::NewGuid().ToString()
try {
    $r = Api "POST" "/questions" @{
        id=$qId; tenant_id=$tenantId; game_id=$gameId; subject="math"
        question_data=@{text="1+1="}; answer_data=@{correct="2"}; difficulty=1
    } $token
    if ($r.id) { OK "POST /questions -> id:$($r.id.Substring(0,[Math]::Min(8,$r.id.Length)))..." }
    else { NG "POST /questions" "no id. Response: $($r | ConvertTo-Json -Compress)" }
} catch { NG "POST /questions" $_.Exception.Message }

try {
    $r = Api "GET" ("/questions?game_id=" + $gameId + "&limit=5") $null $token
    OK "GET /questions -> total=$($r.total) count=$($r.questions.Count)"
} catch { NG "GET /questions" $_.Exception.Message }

try {
    $r = Api "DELETE" "/questions/$qId" $null $token
    if ($r.success) { OK "DELETE /questions -> soft delete OK" }
    else { NG "DELETE /questions" "success=false" }
} catch { NG "DELETE /questions" $_.Exception.Message }

# -------------------------------------------------------
Section "6. Game Saves (0-7)"
try {
    $r = Api "PUT" "/game-saves/$studentId/$gameId" @{
        save_data=@{level=3;score=1200}; save_type="manual"
    } $token
    if ($r.success) { OK "PUT /game-saves/$studentId/$gameId -> saved" }
    else { NG "PUT /game-saves" "success=false" }
} catch { NG "PUT /game-saves" $_.Exception.Message }

try {
    $r = Api "GET" "/game-saves/$studentId/$gameId" $null $token
    if ($r.exists) { OK "GET /game-saves/$studentId/$gameId -> exists=true level=$($r.save_data.level)" }
    else { NG "GET /game-saves" "exists=false" }
} catch { NG "GET /game-saves" $_.Exception.Message }

try {
    $r = Api "DELETE" "/game-saves/$studentId/$gameId" $null $token
    if ($r.success) { OK "DELETE /game-saves/$studentId/$gameId -> deleted" }
    else { NG "DELETE /game-saves" "success=false" }
} catch { NG "DELETE /game-saves" $_.Exception.Message }

# -------------------------------------------------------
Section "7. ALT Coins (0-3)"
try {
    $r = Api "GET" "/t/$tenantSlug/coins" $null $token
    OK "GET /t/$tenantSlug/coins -> logs=$($r.logs.Count)"
} catch {
    # Try alternative path
    try {
        $r = Api "GET" "/coin-logs?tenant_id=$tenantId" $null $token
        OK "GET /coin-logs -> count=$($r.Count)"
    } catch { NG "GET /t/$tenantSlug/coins" $_.Exception.Message }
}

# -------------------------------------------------------
Section "8. Static Files"
@("/index.html","/parent.html","/js/trail-sdk.js",
  "/games/shared/trail-auth.js","/games/shared/trail-auth.css",
  "/games/shared/trail-score.js","/games/shared/trail-timer.js") | ForEach-Object {
    $p = $_
    try {
        $res = Invoke-WebRequest -Uri "$BASE$p" -UseBasicParsing -ErrorAction Stop
        if ($res.StatusCode -eq 200) { OK "GET $p -> 200 OK" }
        else { NG "GET $p" "HTTP $($res.StatusCode)" }
    } catch { NG "GET $p" $_.Exception.Message }
}

# -------------------------------------------------------
Write-Host ""
Write-Host "================================" -ForegroundColor White
$total = $pass + $fail
Write-Host "Result: $pass / $total passed" -ForegroundColor White
if ($fail -eq 0) { Write-Host "All tests passed! Phase 0 complete!" -ForegroundColor Green }
else {
    Write-Host "$fail test(s) failed." -ForegroundColor Yellow
    Write-Host "Note: play-sessions/coins failures may need server-side fixes." -ForegroundColor DarkYellow
}
Write-Host "================================"
Write-Host ""