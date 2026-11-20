# Windows source verification recovery — Stockfish.js 19.0.1

These commands are for a Windows PowerShell 5.1 workstation with Python 3, Node 22+, Git, and a current checkout of `release/stockfish-source-asset-inventory`.

## 1. Obtain the fixed source archive (no Windows symlink privilege needed)

```powershell
git fetch origin
git switch release/stockfish-source-asset-inventory
git pull --ff-only
npm ci
npm run android:source:test
npm run android:source:fetch
```

The source fetcher now uses `scripts/stockfish-source-archive.py assemble` to copy the original tar entries (including symbolic-link metadata) directly to a new tar.gz, adding the content-address-verified `nn-61e7af4bb97d.nnue` network input. `npm run android:source:test` uses a synthetic source archive with the same optional symlink shape and verifies preservation plus Windows-safe build extraction. **It does not extract `examples/src` or require Windows Developer Mode / administrator-created symlinks.** The final archive preserves the original symlink information for recipients on compatible systems.

Check `release-sources/stockfish-corresponding-source.tar.gz` and the unverified local `compliance/stockfish-source-attestation.json`. Both are ignored by Git. Source download and archive integrity do not constitute binary reproducibility.

## 2. Install Emscripten 6.0.9

Recommended by the official Emscripten SDK documentation: https://emscripten.org/docs/getting_started/downloads.html

In PowerShell:

```powershell
$emsdk = Join-Path $env:USERPROFILE 'tools\emsdk'
New-Item -ItemType Directory -Force -Path (Split-Path $emsdk -Parent) | Out-Null
if (!(Test-Path (Join-Path $emsdk 'emsdk.bat'))) {
    git clone https://github.com/emscripten-core/emsdk.git $emsdk
}
Push-Location $emsdk
.\emsdk.bat install 6.0.9
if ($LASTEXITCODE -ne 0) { throw 'emsdk install failed' }
.\emsdk.bat activate 6.0.9
if ($LASTEXITCODE -ne 0) { throw 'emsdk activate failed' }
Pop-Location
```

**Important on Windows:** `emsdk_env.bat` sets environment variables for a **cmd.exe** process. Running it from PowerShell does not automatically propagate its changes into the parent PowerShell. Open a nested command shell using:

```powershell
cmd /k "$emsdk\emsdk_env.bat"
```

Within the newly opened **cmd.exe** window (same repository working directory):

```bat
emcc --version
npm run android:source:verify
```

Confirm that `emcc --version` contains **6.0.9**. Keep the exact SDK, do not substitute `latest`. If installation fails, record the precise SDK error rather than marking the build as reproduced.

## 3. Acceptance and evidence

`npm run android:source:verify` now uses `scripts/stockfish-source-archive.py extract` to materialize normal source files and **skip only** the optional `examples/src` symlink. Unexpected symlinks or unsafe tar entries fail the script. It attempts a real compile, then compares the rebuilt Stockfish.js lite-single JS and WASM against exact npm-package bytes.

Review `artifacts/stockfish-source-rebuild-evidence.json`. Only if both comparisons are `exactMatch: true` and `status: REPRODUCIBLE_EXACT` may the technical reviewer consider completing the source attestation. If either differs, keep it unverified and investigate toolchain/build settings. The source attestation is not automatically set to true.

After independent technical/legal review and **only once the GPL gate is satisfied**, run:

```powershell
npm run android:release:prepare
cd android
.\gradlew.bat bundleRelease
cd ..
npm run android:aab:verify
```

Verify the bundle upload signature separately; `android:aab:verify` only checks included assets and manifests. Never upload to public Play or add monetization while release gates remain blocked.

## 4. Dependency vulnerabilities from npm ci

The reported **8 vulnerabilities** have not been individually triaged because the exact `npm audit --json` output has not been provided. Capture it reproducibly:

```powershell
npm audit --omit=dev --json > artifacts\npm-audit-production.json
npm audit --json > artifacts\npm-audit-full.json
```

Create the `artifacts` directory first if needed. Distinguish production from build/dev-only dependencies and assess exploitability and upgrade impact. Do **not** run `npm audit fix --force` as a shortcut during the pinned engine compliance qualification: it could change the locked software and invalidate the exact-version source checks.
