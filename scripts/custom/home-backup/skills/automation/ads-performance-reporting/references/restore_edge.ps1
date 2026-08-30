Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinRestore {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$hwnd = [IntPtr]198544
[WinRestore]::ShowWindow($hwnd, 9)
[WinRestore]::SetForegroundWindow($hwnd)
