# Run from an elevated PowerShell terminal.
$ErrorActionPreference = "Stop"
Enable-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM" -All
Write-Host "Windows Sandbox enabled. Reboot if Windows requests it."
