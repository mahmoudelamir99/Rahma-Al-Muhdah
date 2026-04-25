@echo off
setlocal

set "ROOT=%~dp0"
set "LOGDIR=%ROOT%server-logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

cd /d "%ROOT%"
echo [%date% %time%] admin launcher starting>> "%LOGDIR%\admin.out.log"
where npm>> "%LOGDIR%\admin.out.log" 2>&1
"C:\Program Files\nodejs\npm.cmd" --version>> "%LOGDIR%\admin.out.log" 2>&1
start "" "C:\Program Files\nodejs\npm.cmd" run dev -- --host 0.0.0.0 --port 4174 --strictPort >> "%LOGDIR%\admin.out.log" 2>> "%LOGDIR%\admin.err.log"
echo [%date% %time%] admin server launch requested>> "%LOGDIR%\admin.out.log"