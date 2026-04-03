@echo off
setlocal

set "ROOT=%~dp0"
set "LOGDIR=%ROOT%server-logs"
set "PYTHON=C:\Users\accma\AppData\Local\Programs\Python\Python311\python.exe"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

cd /d "%ROOT%"
echo [%date% %time%] public launcher starting>> "%LOGDIR%\public-site.out.log"
if not exist "%PYTHON%" set "PYTHON=python"
where "%PYTHON%" >> "%LOGDIR%\public-site.out.log" 2>&1
"%PYTHON%" --version >> "%LOGDIR%\public-site.out.log" 2>&1
start "" /min cmd /c ""%PYTHON%" "%ROOT%serve-dir.py" --root "%ROOT%" --port 4173 1>>"%LOGDIR%\public-site-runtime.out.log" 2>>"%LOGDIR%\public-site-runtime.err.log"""
echo [%date% %time%] public server launch requested>> "%LOGDIR%\public-site.out.log"
