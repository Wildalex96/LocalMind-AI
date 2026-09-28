$ErrorActionPreference = "Stop"
$f = Get-WindowsOptionalFeature -Online -FeatureName "Containers-DisposableClientVM"
Write-Host "Containers-DisposableClientVM: $($f.State)"
if ($f.State -ne "Enabled") { exit 2 }
if (-not (Get-Command WindowsSandbox.exe -ErrorAction SilentlyContinue)) { exit 3 }
Write-Host "Windows Sandbox runtime: available"
