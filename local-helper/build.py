import PyInstaller.__main__
import os
import sys

def build():
    PyInstaller.__main__.run([
        'src/main.py',
        '--noconfirm',
        '--clean',
        '--name=InstaGrab Helper',
        '--onedir',
        '--windowed',
        '--noupx',
        '--icon=assets/icon.ico',
        '--add-data=assets/icon.ico;assets',
        '--hidden-import=pystray',
        '--hidden-import=waitress',
        '--hidden-import=flask',
        '--hidden-import=flask_cors',
        '--hidden-import=yt_dlp',
        '--hidden-import=PIL',
        '--hidden-import=win32com',
        '--hidden-import=win32com.client',
        '--distpath=dist',
        '--workpath=build',
    ])

if __name__ == '__main__':
    build()
