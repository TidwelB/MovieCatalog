@echo off
setlocal
cd /d "%~dp0"
title MovieCatalog Updater
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-windows.ps1"
if errorlevel 1 (
  echo.
  echo The update did not complete. Press any key to close this window.
  pause >nul
)
