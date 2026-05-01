@echo off
cd /d "%~dp0"
title Finance Dashboard Launcher
color 0B

echo ===================================================
echo        FINANCE DASHBOARD LAUNCHER
echo ===================================================
echo.
echo Thu muc hien tai: %cd%
echo.

IF NOT EXIST "node_modules\firebase" (
    echo [HE THONG] Dang cai dat thu vien...
    call npm install
    echo [HE THONG] Cai dat xong!
    echo.
)

echo [HE THONG] Dang khoi dong Giao dien...
start "Finance Frontend" cmd /k "cd /d "%~dp0" && npx vite --host --open"

echo.
echo ===================================================
echo   HOAN TAT! Trinh duyet se tu dong mo.
echo   De tat: dong cua so den moi hien ra.
echo ===================================================
echo.
pause
