@echo off
echo ================================================================================
echo STARTING FULL-STACK EXPENSE TRACKER APPLICATION
echo ================================================================================
echo.
echo Starting Backend API...
start "Expense Tracker API" cmd /k "python simple_working_api.py"
echo.
echo Waiting 3 seconds for API to start...
timeout /t 3 /nobreak >nul
echo.
echo Opening Frontend in Browser...
start "" "index.html"
echo.
echo ================================================================================
echo FULL-STACK APPLICATION STARTED!
echo ================================================================================
echo.
echo Backend API: http://127.0.0.1:5000
echo Frontend: Opening in your default browser
echo.
echo Press any key to close this window...
pause >nul
