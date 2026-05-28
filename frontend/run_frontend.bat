@echo off
echo ========================================================================
echo JavaF Exchange (HF-X) Local Frontend Web Server (Windows)
echo ========================================================================
echo Notice: ES6 Modules(type="module") require an HTTP server due to CORS.
echo         We serve the files on localhost to bypass this.
echo.
echo - URL: http://localhost:8005/main.html
echo - Admin: http://localhost:8005/admin.html
echo ========================================================================
echo.

rem Get the directory where this BAT file is located and remove trailing backslash
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

rem Check if python is available
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python -m http.server --directory "%SCRIPT_DIR%" 8005
) else (
    where python3 >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        python3 -m http.server --directory "%SCRIPT_DIR%" 8005
    ) else (
        echo Error: Python is not installed or not in PATH.
        echo Please install Python and try again.
        pause
    )
)
