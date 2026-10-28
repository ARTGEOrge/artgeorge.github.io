@echo off
rem Opens Photo Studio, the private uploader for the Photos page.
cd /d "%~dp0.."
python photos\studio.py
pause
