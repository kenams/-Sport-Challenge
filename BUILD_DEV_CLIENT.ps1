# BUILD_DEV_CLIENT.ps1
# Script pour builder le Development Client Expo avec modules natifs compilés

param(
    [switch]$CleanFirst = $false,
    [switch]$SkipLogin = $false
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "BUILDING EXPO DEVELOPMENT CLIENT WITH NATIVE MODULES" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will create an APK with compiled native modules:" -ForegroundColor Yellow
Write-Host "  ✓ ExpoCamera (native camera access)" -ForegroundColor Yellow
Write-Host "  ✓ react-native-webrtc (WebRTC peer connections)" -ForegroundColor Yellow
Write-Host "  ✓ All other Expo plugins" -ForegroundColor Yellow
Write-Host ""
Write-Host "Time required: 10-15 minutes" -ForegroundColor Yellow
Write-Host ""

$projectPath = "C:\Users\kenam\Documents\sport-challenge-app"
Set-Location $projectPath

# Step 1: Clean and prebuild
Write-Host "Step 1/4: Preparing project with native modules..." -ForegroundColor Cyan
Write-Host ""

if ($CleanFirst) {
    Write-Host "🧹 Cleaning previous builds..."
    Remove-Item -Path "android" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "ios" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "🔨 Running prebuild (generating android/ with native modules)..."
& npx expo prebuild --clean

Write-Host ""
Write-Host "Step 2/4: Verifying EAS CLI..." -ForegroundColor Cyan
Write-Host ""

$eas = & where.exe eas 2>$null
if (-not $eas) {
    Write-Host "Installing EAS CLI globally..."
    npm install -g eas-cli
}
else {
    Write-Host "✓ EAS CLI found: $eas"
}

# Step 2: Login if needed
if (-not $SkipLogin) {
    Write-Host ""
    Write-Host "Step 3/4: Authenticating with Expo..." -ForegroundColor Cyan
    Write-Host ""
    & eas login
}
else {
    Write-Host ""
    Write-Host "Step 3/4: Skipping login (already authenticated)" -ForegroundColor Cyan
    Write-Host ""
}

# Step 3: Build
Write-Host "Step 4/4: Building Development Client for Android..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ This may take 10-15 minutes..." -ForegroundColor Yellow
Write-Host ""

$buildResult = & eas build --platform android --profile development

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "✅ BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1️⃣  Go to: https://expo.dev/accounts/@<your-username>/projects" -ForegroundColor White
    Write-Host "2️⃣  Find the build and download the APK" -ForegroundColor White
    Write-Host "3️⃣  Transfer to your Xiaomi 11T Pro" -ForegroundColor White
    Write-Host "4️⃣  Install:" -ForegroundColor White
    Write-Host "    adb install path\to\app-debug.apk" -ForegroundColor Gray
    Write-Host "5️⃣  Run:" -ForegroundColor White
    Write-Host "    npm start" -ForegroundColor Gray
    Write-Host "6️⃣  Scan QR with Development Client app" -ForegroundColor White
    Write-Host "7️⃣  Test: Home → Arène → Page Live → Tester Arena Live" -ForegroundColor White
    Write-Host ""
    Write-Host "✨ ExpoCamera native module will now work!" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  • Verify you're logged in: eas whoami" -ForegroundColor Gray
    Write-Host "  • Check app.json is valid: npx expo config" -ForegroundColor Gray
    Write-Host "  • Try: eas build --platform android --profile development --wait" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "For more info, see: EXPOCAMERA_NATIVE_SOLUTION.md" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
