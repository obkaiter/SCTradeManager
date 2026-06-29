@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ========================================
echo   SCTradeManager Item Manager
echo ========================================
echo.

set DJANGO_DEBUG=True
set "PYTHON_CMD=venv\Scripts\python.exe"

if exist "%PYTHON_CMD%" goto ensure_deps

echo Virtual environment was not found. Creating venv...
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -m venv venv
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo Python was not found. Install Python or create venv manually.
        pause
        exit /b 1
    )
    python -m venv venv
)

if errorlevel 1 (
    echo Failed to create virtual environment.
    pause
    exit /b 1
)

if not exist "%PYTHON_CMD%" (
    echo venv was created, but Python executable was not found.
    pause
    exit /b 1
)

:ensure_deps
"%PYTHON_CMD%" -m pip show django >nul 2>nul
if errorlevel 1 (
    echo Installing dependencies...
    "%PYTHON_CMD%" -m pip install django openpyxl
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo Applying migrations...
"%PYTHON_CMD%" manage.py migrate
if errorlevel 1 (
    echo Failed to apply migrations.
    pause
    exit /b 1
)

echo.
echo Open in browser: http://127.0.0.1:8000
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

"%PYTHON_CMD%" manage.py runserver

pause
