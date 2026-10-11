@echo off
chcp 65001 >nul
node build-static.js %*
pause
