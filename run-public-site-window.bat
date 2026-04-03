@echo off
setlocal

set "ROOT=%~dp0."
cd /d "%ROOT%"
title Rahma Public Site - 4173
echo Serving:
echo   http://localhost:4173/
echo   http://192.168.1.5:4173/
echo.

set "NODE_EXE="
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"

if not defined NODE_EXE (
  echo Node.js was not found.
  echo Install Node.js or run the project from a machine that has it.
  echo.
  echo Server did not start. Press any key to close.
  pause >nul
  exit /b 1
)

"%NODE_EXE%" "%ROOT%\serve-dir.mjs" --port 4173
echo.
echo Server stopped. Press any key to close.
pause >nul
