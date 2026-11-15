@echo off
rem One-click local HTTPS test server for Owlbear Rodeo extension.
rem Keep this window open; close it -> the extension URL stops working.
cd /d "%~dp0"
echo Starting local HTTPS server (https://localhost:8443/manifest.json) ...
echo.
node "dev\serve-https.mjs"
echo.
echo Server stopped. Press any key to close.
pause >nul
