@echo off
title Noor AI - O'chirish
color 0C
echo.
echo  ============================================
echo    Noor AI (by abdunurcreator) - O'chirish
echo  ============================================
echo.

:: Autostart dan o'chirish
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
if exist "%STARTUP%\NoorAI.vbs" (
    del "%STARTUP%\NoorAI.vbs"
    echo  [OK] Autostart o'chirildi.
) else (
    echo  [--] Autostart topilmadi.
)

:: Desktop shortcut o'chirish
set "DESKTOP=%USERPROFILE%\Desktop"
if exist "%DESKTOP%\NoorAI.lnk" (
    del "%DESKTOP%\NoorAI.lnk"
    echo  [OK] Desktop shortcut o'chirildi.
)

:: Node.js jarayonini to'xtatish
taskkill /f /im node.exe >nul 2>&1
echo  [OK] Server to'xtatildi.

echo.
echo  Noor AI o'chirildi.
echo.
pause
