@echo off
chcp 65001 >nul
cd /d "%~dp0"
py -3 -m pip install -q pyinstaller pynput
py -3 -m PyInstaller --noconfirm --clean --onefile --name uss-arty-f2 --console artillery-f2-hotkey.py
if exist dist\uss-arty-f2.exe copy /Y dist\uss-arty-f2.exe . >nul
echo Done: uss-arty-f2.exe
pause