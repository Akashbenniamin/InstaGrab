@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo  InstaGrab Helper - Build Script
echo ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.12+ from python.org
    pause
    exit /b 1
)

:: Step 1: Create virtual environment
echo [1/6] Creating virtual environment...
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate

:: Step 2: Install dependencies
echo [2/6] Installing dependencies...
pip install -r requirements.txt pyinstaller --quiet

:: Step 3: Generate icon
echo [3/6] Generating application icon...
python generate_icon.py
if not exist assets\icon.ico (
    echo ERROR: Icon generation failed.
    pause
    exit /b 1
)

:: Step 4: Download FFmpeg (if not present)
echo [4/6] Checking FFmpeg...
if not exist ffmpeg\ffmpeg.exe (
    echo Downloading FFmpeg essentials...
    mkdir ffmpeg 2>nul
    
    :: Download FFmpeg from gyan.dev
    powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg_temp.zip' }"
    
    if exist ffmpeg_temp.zip (
        echo Extracting FFmpeg...
        powershell -Command "& { $ProgressPreference='SilentlyContinue'; Expand-Archive -Path 'ffmpeg_temp.zip' -DestinationPath 'ffmpeg_extract' -Force }"
        
        :: Find and copy ffmpeg.exe and ffprobe.exe
        for /r ffmpeg_extract %%f in (ffmpeg.exe) do copy "%%f" "ffmpeg\ffmpeg.exe" >nul 2>&1
        for /r ffmpeg_extract %%f in (ffprobe.exe) do copy "%%f" "ffmpeg\ffprobe.exe" >nul 2>&1
        
        :: Cleanup
        del ffmpeg_temp.zip 2>nul
        rmdir /s /q ffmpeg_extract 2>nul
        
        if exist ffmpeg\ffmpeg.exe (
            echo FFmpeg downloaded successfully.
        ) else (
            echo WARNING: FFmpeg download failed. You can manually place ffmpeg.exe and ffprobe.exe in the ffmpeg\ folder.
        )
    ) else (
        echo WARNING: FFmpeg download failed. You can manually place ffmpeg.exe and ffprobe.exe in the ffmpeg\ folder.
    )
) else (
    echo FFmpeg already present.
)

:: Step 5: Build with PyInstaller
echo [5/6] Building executable with PyInstaller...
python build.py
if not exist "dist\InstaGrab Helper\InstaGrab Helper.exe" (
    echo ERROR: PyInstaller build failed.
    pause
    exit /b 1
)

:: Copy FFmpeg to dist
if exist ffmpeg\ffmpeg.exe (
    echo Copying FFmpeg to distribution...
    mkdir "dist\InstaGrab Helper\ffmpeg" 2>nul
    copy ffmpeg\ffmpeg.exe "dist\InstaGrab Helper\ffmpeg\" >nul
    copy ffmpeg\ffprobe.exe "dist\InstaGrab Helper\ffmpeg\" >nul
)

:: Step 6: Build installer (requires Inno Setup)
echo [6/6] Building installer...
where ISCC >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ==========================================
    echo  PyInstaller build COMPLETE!
    echo  Executable: dist\InstaGrab Helper\InstaGrab Helper.exe
    echo ==========================================
    echo.
    echo NOTE: Inno Setup Compiler (ISCC) not found in PATH.
    echo To build the installer (.exe), install Inno Setup from:
    echo   https://jrsoftware.org/isdl.php
    echo Then run: ISCC installer\setup.iss
) else (
    ISCC installer\setup.iss
    echo.
    echo ==========================================
    echo  BUILD COMPLETE!
    echo  Executable: dist\InstaGrab Helper\InstaGrab Helper.exe
    echo  Installer:  dist\InstaGrabSetup.exe
    echo ==========================================
)

echo.
pause
