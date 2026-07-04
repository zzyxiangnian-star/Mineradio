Unicode true
!include "MUI2.nsh"

!ifndef VERSION
  !define VERSION "1.3.0"
!endif
!ifndef OUTFILE
  !define OUTFILE "dist\Mineradio-Setup-${VERSION}.exe"
!endif
!ifndef APPDIR
  !define APPDIR "dist\win-unpacked"
!endif
!ifndef ICON
  !define ICON "build\icon.ico"
!endif

Name "Mineradio"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Mineradio"
InstallDirRegKey HKCU "Software\Mineradio" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Mineradio.exe"
!define MUI_FINISHPAGE_RUN_TEXT "运行 Mineradio"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${APPDIR}\*.*"

  CreateDirectory "$SMPROGRAMS\Mineradio"
  CreateShortcut "$SMPROGRAMS\Mineradio\Mineradio.lnk" "$INSTDIR\Mineradio.exe"
  CreateShortcut "$SMPROGRAMS\Mineradio\卸载 Mineradio.lnk" "$INSTDIR\Uninstall Mineradio.exe"
  CreateShortcut "$DESKTOP\Mineradio.lnk" "$INSTDIR\Mineradio.exe"

  WriteUninstaller "$INSTDIR\Uninstall Mineradio.exe"
  WriteRegStr HKCU "Software\Mineradio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "DisplayName" "Mineradio ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "Publisher" "Mineradio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "DisplayIcon" "$INSTDIR\Mineradio.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "UninstallString" '"$INSTDIR\Uninstall Mineradio.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Mineradio.lnk"
  Delete "$SMPROGRAMS\Mineradio\Mineradio.lnk"
  Delete "$SMPROGRAMS\Mineradio\卸载 Mineradio.lnk"
  RMDir "$SMPROGRAMS\Mineradio"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Mineradio"
  DeleteRegKey HKCU "Software\Mineradio"
  RMDir /r "$INSTDIR"
SectionEnd
