@echo off
setlocal enabledelayedexpansion
title Noor AI - Windows O'rnatish Dasturi (Setup)
color 0A
cls

echo =======================================================
echo              NOOR AI - SETUP INSTALLER
echo                 by abdunurcreator
echo =======================================================
echo.
echo Noor AI dasturini kompyuteringizga o'rnatish uchun
echo qaysi disk va papkaga o'rnatishni tanlang.
echo.

set "DEFAULT_DIR=C:\NoorAI"
echo Standart o'rnatish joyi: %DEFAULT_DIR%
echo.
set /p "TARGET_DIR=O'rnatish papkasi (masalan: C:\NoorAI yoki D:\NoorAI) [Enter = Standart]: "

if "%TARGET_DIR%"=="" set "TARGET_DIR=%DEFAULT_DIR%"

echo.
echo [1/4] Papka yaratilmoqda: %TARGET_DIR% ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [2/4] Dastur fayllari nusxalanmoqda...
xcopy /E /I /Y /Q "%~dp0*" "%TARGET_DIR%\"

echo [3/4] Ishga tushirish yorlig'i (Desktop Shortcut) yaratilmoqda...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\NoorAI.lnk"
set "SCRIPT_VBS=%TEMP%\CreateShortcut.vbs"

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SCRIPT_VBS%"
echo sLinkFile = "%SHORTCUT_PATH%" >> "%SCRIPT_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SCRIPT_VBS%"
echo oLink.TargetPath = "%TARGET_DIR%\start.bat" >> "%SCRIPT_VBS%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%SCRIPT_VBS%"
echo oLink.Description = "Noor AI (by abdunurcreator)" >> "%SCRIPT_VBS%"
echo oLink.IconLocation = "shell32.dll, 14" >> "%SCRIPT_VBS%"
echo oLink.Save >> "%SCRIPT_VBS%"

cscript //nologo "%SCRIPT_VBS%"
if exist "%SCRIPT_VBS%" del "%SCRIPT_VBS%"

echo [4/4] Ishga tushirish skripti yaratilmoqda...
(
echo @echo off
echo title Noor AI
echo cd /d "%TARGET_DIR%"
echo start http://localhost:3000/main
echo node server.js
) > "%TARGET_DIR%\start.bat"

cls
echo =======================================================
echo        NOOR AI MUVAFFAQIYATLI O'RNATILDI! 🎉
echo              by abdunurcreator
echo =======================================================
echo.
echo O'rnatilgan joy: %TARGET_DIR%
echo Ish stolingizda (Desktop) "NoorAI" yorlig'i hosil bo'ldi.
echo.
echo Dasturni hozir ishga tushirishni xohlaysizmi? (Y/N)
set /p "RUN_NOW=[Y/N]: "
if /i "%RUN_NOW%"=="Y" (
    cd /d "%TARGET_DIR%"
    start start.bat
)
pause
