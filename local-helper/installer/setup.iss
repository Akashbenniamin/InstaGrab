#define MyAppName "InstaGrab Helper"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "InstaGrab"
#define MyAppExeName "InstaGrab Helper.exe"

[Setup]
AppId={{B7F3A2E1-9C4D-4B8E-A6F5-2D1E8C7B3A9F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\InstaGrabHelper
DefaultGroupName={#MyAppName}
OutputDir=..\dist
OutputBaseFilename=InstaGrab-Helper-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; No admin rights required - installs to user profile
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
; Show license/info
;LicenseFile=..\..\LICENSE
InfoBeforeFile=..\..\README.md

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Start {#MyAppName} automatically when Windows starts"; GroupDescription: "Windows Integration:"

[Files]
; PyInstaller output directory
Source: "..\dist\InstaGrab Helper\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
; Desktop (optional)
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Auto-start with Windows (if task selected)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "InstaGrabHelper"; ValueData: """{app}\{#MyAppExeName}"" --minimized"; Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Launch after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Kill the app before uninstalling
Filename: "taskkill"; Parameters: "/F /IM ""{#MyAppExeName}"""; Flags: runhidden

[UninstallDelete]
; Clean up config directory
Type: filesandordirs; Name: "{userappdata}\InstaGrab"
