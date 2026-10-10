@echo off
cd /d "%~dp0"
set PORT=8765
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:%PORT%
  py -3 -m http.server %PORT%
  goto :eof
)
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT%
  goto :eof
)
echo Python was not found. Opening index.html directly instead.
start "" "%~dp0index.html"
