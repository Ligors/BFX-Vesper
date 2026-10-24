@echo off
title BFX Vesper Public Tunnel
echo ========================================================
echo   Starting Cloudflare Public Tunnel for port 5000...
echo   Copy the https://....trycloudflare.com URL into your
echo   phone's Vesper App under Settings -> Backend Server URL
echo ========================================================
cd /d "%~dp0"
.\cloudflared.exe tunnel --url http://localhost:5000
pause
