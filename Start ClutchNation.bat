@echo off
title Clutch Nation Launcher
echo.
echo  ============================================
echo   CLUTCH NATION - Enterprise Discord Security
echo  ============================================
echo.
echo  Starting Clutch Nation...
echo.
cd /d "%~dp0launcher"
.\node_modules\electron\dist\electron.exe .
