@echo off
title AbdunurCreator - O'chirish
color 0C
echo.
echo  ============================================
echo    AbdunurCreator - O'chirish
echo  ============================================
echo.

:: Autostart dan o'chirish
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP%\AbdunurCreator.vbs" (
    del "%STARTUP%\AbdunurCreator.vbs"
    echo  [OK] Autostart o'chirildi.
) else (
    echo  [--] Autostart topilmadi.
)

:: Desktop shortcut o'chirish
set "DESKTOP=%USERPROFILE%\Desktop"
if exist "%DESKTOP%\AbdunurCreator.url" (
    del "%DESKTOP%\AbdunurCreator.url"
    echo  [OK] Desktop shortcut o'chirildi.
)

:: Node.js jarayonini to'xtatish
taskkill /f /im node.exe >nul 2>&1
echo  [OK] Server to'xtatildi.

echo.
echo  AbdunurCreator o'chirildi.
echo.
pause
