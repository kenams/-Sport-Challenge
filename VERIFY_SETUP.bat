#!/bin/bash
# verify_setup.bat - Vérifiez que tout est prêt pour le test

@echo off
cls

echo ============================================================
echo VERIFICATION - ARENA LIVE TEST SETUP
echo ============================================================
echo.

set errors=0

echo Checking prerequisites...
echo.

REM Check Node.js
echo - Checking Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo   ✓ Node.js !NODE_VERSION! found
) else (
    echo   ✗ Node.js not found
    set /a errors=errors+1
)

REM Check npm
echo - Checking npm...
npm --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo   ✓ npm !NPM_VERSION! found
) else (
    echo   ✗ npm not found
    set /a errors=errors+1
)

REM Check ADB
echo - Checking ADB...
adb version >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ ADB found
) else (
    echo   ✗ ADB not found (needed for Option A)
    set /a errors=errors+1
)

REM Check device
echo - Checking Android device...
adb devices | findstr /R "emulator|device" >nul
if %errorlevel% equ 0 (
    echo   ✓ Device connected
) else (
    echo   ✗ No device connected
    echo      Please: Connect USB cable + Enable USB debugging
    set /a errors=errors+1
)

REM Check expo-cli
echo - Checking Expo CLI...
expo --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('expo --version') do set EXPO_VERSION=%%i
    echo   ✓ Expo CLI !EXPO_VERSION! found
) else (
    echo   ✗ Expo CLI not found (needed for npm start)
    set /a errors=errors+1
)

REM Check eas-cli
echo - Checking EAS CLI...
eas --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ EAS CLI found (for Option A)
) else (
    echo   ⚠ EAS CLI not found (optional, needed for Option A)
)

REM Check project files
echo - Checking project files...
if exist "app.json" (
    echo   ✓ app.json found
) else (
    echo   ✗ app.json not found
    set /a errors=errors+1
)

if exist "eas.json" (
    echo   ✓ eas.json found
) else (
    echo   ✗ eas.json not found
    set /a errors=errors+1
)

if exist "android\app\build.gradle" (
    echo   ✓ android/ folder prepared
) else (
    echo   ⚠ android/ folder not found (will be generated with prebuild)
)

if exist "src\screens\ArenaLiveScreen.tsx" (
    echo   ✓ ArenaLiveScreen.tsx found
) else (
    echo   ✗ ArenaLiveScreen.tsx not found
    set /a errors=errors+1
)

REM Check documentation
echo - Checking documentation...
if exist "COMMENT_TESTER.md" (
    echo   ✓ COMMENT_TESTER.md found
) else (
    echo   ✗ Documentation missing
)

echo.
echo ============================================================

if %errors% equ 0 (
    echo ✅ ALL CHECKS PASSED - READY TO TEST!
    echo.
    echo Next steps:
    echo  1. Read: DEMARRAGE_RAPIDE.md
    echo  2. Choose: Option A (native) or Option B (simulation)
    echo  3. Follow: COMMENT_TESTER.md
    echo.
) else (
    echo ❌ ERRORS FOUND - FIX THEM FIRST
    echo.
    echo Fixes needed:
    if not exist "android\app\build.gradle" (
        echo  - Run: npx expo prebuild --clean
    )
    if %errorlevel% neq 0 (
        echo  - Install missing tools
    )
    echo.
)

echo ============================================================
pause
