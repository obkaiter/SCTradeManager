@echo off
chcp 65001 >nul
echo ========================================
echo   P2P Менеджер предметов
echo ========================================
echo.

cd /d "%~dp0"

echo Запуск сервера...
echo.
echo Откройте в браузере: http://127.0.0.1:8000
echo.
echo Для остановки нажмите Ctrl+C
echo ========================================
echo.

set DJANGO_DEBUG=True
venv\Scripts\python.exe manage.py runserver

pause
