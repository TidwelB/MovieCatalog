@echo off
setlocal
cd /d "%~dp0"
title MovieCatalog Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-windows.ps1"
if errorlevel 1 (
  echo.
  echo MovieCatalog could not be launched. Press any key to close this window.
  pause >nul
)
