@echo off
cd /d "%~dp0"
echo [uss-frontend] http://127.0.0.1:8080/
echo [uss-frontend] mp4 Content-Type: video/mp4
node dev-static-server.js
