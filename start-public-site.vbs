Option Explicit

Dim shell, fso, root, logDir, pythonPath, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
logDir = root & "\server-logs"

If Not fso.FolderExists(logDir) Then
  fso.CreateFolder logDir
End If

pythonPath = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python311\python.exe"
If Not fso.FileExists(pythonPath) Then
  pythonPath = "python"
End If

command = "cmd /c """ & pythonPath & """ """ & root & "\serve-dir.py"" --root """ & root & """ --port 4173 1>""" & logDir & "\public-site.out.log"" 2>""" & logDir & "\public-site.err.log"""
shell.Run command, 0, False
