@echo off
title AbdunurCreator - DIAGNOSTIKA
color 0E
cd /d "%~dp0"

echo ============================================
echo   1) Node.js versiyasi
echo ============================================
node --version
if %errorlevel% neq 0 (
    echo.
    echo [XATO] Node.js topilmadi yoki o'rnatilmagan!
    echo Yuklab oling: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo ============================================
echo   2) Paketlarni tekshirish / o'rnatish
echo ============================================
call npm install

echo.
echo ============================================
echo   3) Serverni ishga tushirish
echo ============================================
echo (Bu oyna ochiq turadi. Xato chiqsa, pastda ko'rinadi.)
echo.
node server.js

echo.
echo ============================================
echo   Server to'xtadi yoki xato berdi (yuqorida ko'ring)
echo ============================================
pause
