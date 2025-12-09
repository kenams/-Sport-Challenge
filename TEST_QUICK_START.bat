@echo off
REM TEST_QUICK_START.bat - Script rapide pour lancer les tests

setlocal enabledelayedexpansion

cls
echo ============================================================
echo TEST QUICK START - ARENA LIVE
echo ============================================================
echo.
echo Prerequisites:
echo  - Xiaomi 11T Pro connected via USB
echo  - USB debugging enabled
echo  - ADB installed and in PATH
echo.

REM Check if device is connected
adb devices | findstr /R "emulator|device" >nul
if %errorlevel% neq 0 (
    echo ERROR: No device found!
    echo.
    echo Please:
    echo  1. Connect your Xiaomi 11T Pro via USB
    echo  2. Enable USB debugging in Developer Options
    echo  3. Accept the "Allow debugging" popup
    echo.
    pause
    exit /b 1
)

echo Device found! ✓
echo.
echo ============================================================
echo CHOICE: Which build to test?
echo ============================================================
echo.
echo [1] Option A - Development Client (with native ExpoCamera)
echo [2] Option B - Simulation Mode (no native modules)
echo [3] Exit
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    cls
    echo Testing Option A - Development Client...
    echo.
    echo Step 1: Build Development Client (this may take 15 minutes)
    echo.
    pause
    
    cd /d C:\Users\kenam\Documents\sport-challenge-app
    call eas login
    call eas build --platform android --profile development --wait
    
    if %errorlevel% neq 0 (
        echo Build failed!
        pause
        exit /b 1
    )
    
    echo.
    echo Download the APK from your EAS dashboard and come back.
    pause
    
    echo Installing APK...
    set /p apk_path="Enter APK file path: "
    
    if not exist "!apk_path!" (
        echo APK not found!
        pause
        exit /b 1
    )
    
    adb install -r "!apk_path!"
    
    if %errorlevel% neq 0 (
        echo Installation failed!
        pause
        exit /b 1
    )
    
    echo.
    echo APK installed successfully!
    echo.
    echo Starting Expo server...
    npm start
    
) else if "%choice%"=="2" (
    cls
    echo Testing Option B - Simulation Mode...
    echo.
    
    REM Backup original file
    copy src\screens\ArenaLiveScreen.tsx src\screens\ArenaLiveScreen.tsx.bak >nul
    
    REM Change mode to simulation
    powershell -Command "(Get-Content 'src\screens\ArenaLiveScreen.tsx') -replace 'const mode = \"live\"', 'const mode = \"simulation\"' | Set-Content 'src\screens\ArenaLiveScreen.tsx'"
    
    echo Modified ArenaLiveScreen.tsx to use simulation mode.
    echo.
    echo Starting Expo server...
    npm start
    
    REM Restore original file after exit
    copy src\screens\ArenaLiveScreen.tsx.bak src\screens\ArenaLiveScreen.tsx >nul
    del src\screens\ArenaLiveScreen.tsx.bak
    
) else (
    echo Exiting...
    exit /b 0
)

pause
