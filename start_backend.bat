@echo off
title BFX Vesper Backend Server
echo ========================================================
echo   Starting BFX Vesper Backend Server on port 5000...
echo ========================================================
cd /d "%~dp0APP\bfx-vesper"
node server.js
pause
