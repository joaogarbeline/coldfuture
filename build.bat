@echo off
echo === Coldvisio - Build ===
echo.
echo [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo [2/2] Building backend with embedded frontend...
cd /d "%~dp0backend"
if exist "internal\web\dist" rmdir /s /q "internal\web\dist"
xcopy /e /i /q "..\frontend\dist" "internal\web\dist"
go build -ldflags="-s -w" -o server.exe ./cmd/server
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo.
echo Build completo: backend\server.exe
echo.
echo Para rodar:
echo   1. docker compose up -d postgres
echo   2. backend\server.exe
echo   3. Acesse http://localhost:8080
