import PyInstaller.__main__
import os
import sys

def build():
    PyInstaller.__main__.run([
        'src/main.py',
        '--name=InstaGrab Helper',
        '--onedir',
        '--windowed',
        '--noupx',
        '--icon=assets/icon.ico',
        '--add-data=assets/icon.ico;assets',
        '--hidden-import=pystray',
        '--hidden-import=waitress',
        '--hidden-import=Flask',
        '--hidden-import=flask_cors',
        '--hidden-import=yt_dlp',
        '--hidden-import=PIL',
        '--distpath=dist',
        '--workpath=build',
    ])

if __name__ == '__main__':
    build()
