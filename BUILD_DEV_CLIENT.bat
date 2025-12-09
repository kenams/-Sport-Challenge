@echo off
echo ============================================================
echo BUILDING EXPO DEV CLIENT WITH NATIVE MODULES (ExpoCamera)
echo ============================================================
echo.
echo This will create an Android APK with compiled native modules.
echo You'll be asked to login to Expo/EAS to authorize the build.
echo.
pause

cd /d C:\Users\kenam\Documents\sport-challenge-app

echo.
echo Logging into EAS...
echo.
call eas login

echo.
echo Building Development Client for Android (with ExpoCamera native)...
echo This may take 10-15 minutes...
echo.
call eas build --platform android --profile development

echo.
echo ============================================================
echo BUILD COMPLETE!
echo ============================================================
echo.
echo Next steps:
echo 1. The APK will be available in your EAS dashboard
echo 2. Download it to your Xiaomi 11T Pro
echo 3. Install it: adb install app-debug.apk
echo 4. Run: npm start
echo 5. Open the app and test Arena Live flow
echo.
pause
