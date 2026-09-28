# LocalMind AI 2.0 — automatic Windows releases

Every pushed tag matching `v2.x.x` starts the Windows release pipeline.

Examples: `v2.0.0`, `v2.0.1`, `v2.1.0`, `v2.10.3`.

The pipeline runs on `windows-latest`, validates the tag, installs dependencies, runs tests, builds NSIS and portable Windows executables, verifies `.exe` artifacts, uploads CI artifacts, and creates a GitHub Release with generated notes and attached artifacts.

## Release

```bash
git add .
git commit -m "Prepare LocalMind 2.0 release"
git push origin main
git tag v2.0.0
git push origin v2.0.0
```

A `v2.0.0` push is enough to trigger the complete Windows build and release.
