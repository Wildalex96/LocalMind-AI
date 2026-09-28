# LocalMind AI 2.0 — reconstructed source and Windows build

## Build

On Windows 10/11 with Node.js 20+:

```powershell
npm install
npm test
npm run build:win
```

Artifacts appear in `dist/`.

## Enable Windows Sandbox

Run PowerShell as Administrator:

```powershell
.\scripts\enable-windows-sandbox.ps1
```

After reboot, verify:

```powershell
.\scripts\check-windows-sandbox.ps1
```

## Security model

Agent code execution goes through Electron main process → PermissionManager → WindowsSandboxRunner → PowerShell broker → WindowsSandbox.exe.

The sandbox uses networking and vGPU disabled, Protected Client enabled, and only temporary input/output mounts. Electron does not need Administrator privileges.

## Caveat

The original development dependency lockfile and builder configuration were not present in ASAR. The application logic was recovered from ASAR; package/build metadata was reconstructed.
