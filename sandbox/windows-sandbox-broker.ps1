param([Parameter(Mandatory=$true)][string]$JobDirectory,[int]$TimeoutSeconds=120)
$ErrorActionPreference="Stop"
if(-not(Get-Command WindowsSandbox.exe -ErrorAction SilentlyContinue)){throw "Windows Sandbox is unavailable. Enable Containers-DisposableClientVM."}
$inputDir=Join-Path $JobDirectory "input";$outputDir=Join-Path $JobDirectory "output";$wsb=Join-Path $JobDirectory "job.wsb"
function Escape([string]$s){[System.Security.SecurityElement]::Escape($s)}
@"
<Configuration>
  <MemoryInMB>4096</MemoryInMB><vGPU>Disable</vGPU><Networking>Disable</Networking><ProtectedClient>Enable</ProtectedClient>
  <MappedFolders>
    <MappedFolder><HostFolder>$(Escape $inputDir)</HostFolder><SandboxFolder>C:\LocalMindIn</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$(Escape $outputDir)</HostFolder><SandboxFolder>C:\LocalMindOut</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\LocalMindIn\run.ps1</Command></LogonCommand>
</Configuration>
"@ | Set-Content -Encoding UTF8 $wsb
$p=Start-Process WindowsSandbox.exe -ArgumentList "`"$wsb`"" -PassThru
if(-not $p.WaitForExit($TimeoutSeconds*1000)){Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue;exit 124}
exit $p.ExitCode
