@echo off
title AbdunurCreator - O'rnatuvchi
color 0A
echo.
echo  ============================================
echo    AbdunurCreator AI Platform - O'rnatish
echo  ============================================
echo.

:: Node.js borligini tekshirish
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  [XATO] Node.js topilmadi!
    echo.
    echo  Iltimos avval Node.js yuklab oling:
    echo  https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js topildi.

:: npm paketlarini o'rnatish
echo  [...]  Kerakli paketlar o'rnatilmoqda...
cd /d "%~dp0"
npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  [XATO] npm install bajarilmadi!
    pause
    exit /b 1
)
echo  [OK] Paketlar o'rnatildi.

:: VBS faylini yaratish (server ko'rinmas ishlaydi)
echo  [...]  Fon jarayoni sozlanmoqda...

set "APPDIR=%~dp0"
set "VBSFILE=%APPDIR%start-hidden.vbs"
set "STARTSCRIPT=%APPDIR%start-server.bat"

:: start-server.bat yaratish
(
  echo @echo off
  echo cd /d "%APPDIR%"
  echo node server.js
) > "%STARTSCRIPT%"

:: start-hidden.vbs yaratish
(
  echo Set WshShell = CreateObject^("WScript.Shell"^)
  echo WshShell.Run """%STARTSCRIPT%""", 0, False
) > "%VBSFILE%"

echo  [OK] Fon jarayoni tayyor.

:: Windows autostart ga qo'shish (foydalanuvchi login qilganda ishga tushadi)
echo  [...]  Windows autostart ga qo'shilmoqda...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /y "%VBSFILE%" "%STARTUP%\AbdunurCreator.vbs" >nul
echo  [OK] Autostart sozlandi.

:: Desktop shortcut yaratish
echo  [...]  Desktop shortcut yaratilmoqda...
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUTFILE=%DESKTOP%\AbdunurCreator.url"
(
  echo [InternetShortcut]
  echo URL=http://localhost:3000/a.html
  echo IconFile=shell32.dll
  echo IconIndex=14
) > "%SHORTCUTFILE%"
echo  [OK] Desktop shortcut yaratildi.

:: Hozir ham ishga tushirish
echo  [...]  Server ishga tushirilmoqda...
start "" /b wscript.exe "%VBSFILE%"
timeout /t 2 /nobreak >nul

:: Brauzerni ochish
start http://localhost:3000/a.html

echo.
color 0A
echo  ============================================
echo    O'rnatish muvaffaqiyatli yakunlandi!
echo  ============================================
echo.
echo  Sayt: http://localhost:3000/a.html
echo  Desktop da "AbdunurCreator" shortcut bor.
echo  Windows yonganda server avtomatik ishga tushadi.
echo.
echo  O'chirish uchun: uninstall.bat ni ishga tushiring.
echo.
pause
