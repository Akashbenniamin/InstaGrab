@echo off
title Stop InstaGrab
echo Stopping InstaGrab Helper...

taskkill /F /IM "InstaGrab Helper.exe" 2>nul
taskkill /F /FI "WINDOWTITLE eq InstaGrab Helper*" 2>nul

echo.
echo InstaGrab has been stopped.
echo You can refresh your browser to verify it shows disconnected.
echo.
pause
