#!/usr/bin/env python3
"""Exercise the *verified* complete-source ZIP in an isolated temporary checkout.

No signing, Play upload, source publication, or changes to the user's current
working tree. Builds a debug Android APK, not a release AAB. External toolchains
and npm/Gradle caches must be configured on the qualification machine.
"""
import hashlib
import datetime
import argparse
import stat
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "release-sources/chess-coach-complete-source-candidate.zip"
VERIFICATION = ROOT / "artifacts/chess-coach-complete-source-verification.json"
OUTPUT = ROOT / "artifacts/chess-coach-clean-source-build.json"
PREFIX = "chess-coach-source/"
RESULTS = []
RUN_STARTED = datetime.datetime.now(datetime.timezone.utc).isoformat()
PARSER = argparse.ArgumentParser(description='Build verified source ZIP into isolated Android debug APK')
PARSER.add_argument('--preflight-only', action='store_true', help='Validate source ZIP and host prerequisites without invoking npm/Gradle')
ARGS = PARSER.parse_args()
BASELINE = '1d3d85d6f3e889beda0a97c4f59e29f51902f9c2'
APK_COPY = ROOT / 'artifacts/chess-coach-clean-source-debug.apk'
PREFLIGHT_OUTPUT = ROOT / 'artifacts/chess-coach-clean-source-preflight.json'
REQUIRED_ASSETS = [
    'assets/public/engine/stockfish-19-lite-single.js',
    'assets/public/engine/stockfish-19-lite-single.wasm',
    'assets/public/engine/Stockfish-GPL-3.0.txt',
    'assets/public/licenses.html',
]
for category in ('spatial','fantasy','chessnut'):
    for side in ('w','b'):
        for piece in ('P','N','B','R','Q','K'):
            REQUIRED_ASSETS.append('assets/public/pieces/'+category+'/'+side+piece+'.svg')
def digest(data):
    return hashlib.sha256(data).hexdigest()
def run(args,cwd):
    command = " ".join(args)
    print("RUN:", command, flush=True)
    p=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                     text=True,errors="replace",shell=False)
    lines=p.stdout.splitlines()
    RESULTS.append({"command":command,"exitCode":p.returncode,
                    "tail":lines[-35:]})
    for line in lines[-20:]:
        print(line, flush=True)
    if p.returncode:
        raise RuntimeError(command+" failed with exit "+str(p.returncode))

def main():
    if not ZIP.is_file() or not VERIFICATION.is_file():
        raise RuntimeError("Missing complete source ZIP or formal ZIP verification")
    prior=json.loads(VERIFICATION.read_text(encoding="utf8"))
    if prior.get("status")!="COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING" or prior.get("errors") or prior.get("archiveSha256")!=digest(ZIP.read_bytes()):
        raise RuntimeError("Full-source ZIP verification is stale or failed")
    if prior.get("gitCommit")!=BASELINE or prior.get("trackedFileCount")!=371:
        raise RuntimeError("Source ZIP verification is not the qualified 1d3d85d / 371-file baseline")
    with zipfile.ZipFile(ZIP) as check:
        manifest_name = PREFIX + "SOURCE_MANIFEST.json"
        if manifest_name not in check.namelist():
            raise RuntimeError("Complete-source ZIP lacks its own manifest")
        manifest=json.loads(check.read(manifest_name))
        if manifest.get("gitCommit")!=BASELINE or manifest.get("trackedFileCount")!=371:
            raise RuntimeError("ZIP internal manifest does not match qualified baseline")
        if manifest.get("stockfishSourceSha256")!=prior.get("stockfishSourceSha256"):
            raise RuntimeError("Nested Stockfish source identity differs from accepted verification")
        entries=check.infolist()
        if len(entries)!=len({entry.filename for entry in entries}):
            raise RuntimeError("Duplicate ZIP member detected")
        expected_files={"chess-coach-source/"+x["path"] for x in manifest.get("files",[])}
        expected_files.update({PREFIX+"SOURCE_MANIFEST.json", PREFIX+"upstream/stockfish-corresponding-source.tar.gz"})
        actual_files={x.filename for x in entries if not x.is_dir()}
        if actual_files!=expected_files:
            raise RuntimeError("Complete-source ZIP file inventory differs from its manifest")
        if len(manifest.get("files",[]))!=371:
            raise RuntimeError("Internal tracked-file list does not contain 371 entries")
        for entry in entries:
            path=PurePosixPath(entry.filename)
            if (path.is_absolute() or ".." in path.parts or "\\" in entry.filename
                    or not entry.filename.startswith(PREFIX)):
                raise RuntimeError("Unsafe ZIP path: "+entry.filename)
            if stat.S_IFMT(entry.external_attr >> 16)==stat.S_IFLNK:
                raise RuntimeError("Unexpected ZIP symlink: "+entry.filename)
        nested=check.read(PREFIX+"upstream/stockfish-corresponding-source.tar.gz")
        if digest(nested)!=prior.get("stockfishSourceSha256"):
            raise RuntimeError("Nested Stockfish tarball digest does not match qualified verification")
    # Reject unsupported host environments before doing a long npm/Gradle build.
    if shutil.which("node") is None or shutil.which("npm.cmd" if os.name=="nt" else "npm") is None:
        raise RuntimeError("Node.js and npm must be on PATH")
    java_home = os.environ.get("JAVA_HOME")
    if shutil.which("java") is None and not (java_home and (Path(java_home) / "bin" / ("java.exe" if os.name=="nt" else "java")).is_file()):
        raise RuntimeError("Java missing: set JAVA_HOME to your installed JDK (Android Studio JBR is acceptable)")
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk:
        raise RuntimeError("Android SDK not configured: set ANDROID_HOME to your SDK folder. The isolated source ZIP does not include local.properties.")
    if sdk and not Path(sdk).is_dir():
        raise RuntimeError("Configured ANDROID_HOME/ANDROID_SDK_ROOT directory does not exist: "+sdk)
    if ARGS.preflight_only:
        PREFLIGHT_OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        preflight={
            "status":"CLEAN_SOURCE_PREFLIGHT_PASS_BUILD_PENDING",
            "baselineCommit":BASELINE,
            "trackedFileCount":371,
            "qualifiedSourceZipSha256":digest(ZIP.read_bytes()),
            "environment":{"javaHome":str(java_home or ""),"androidSdk":str(sdk)},
            "legalApproval":False,
            "signedReleaseAabAccepted":False,
            "commands":[],
        }
        PREFLIGHT_OUTPUT.write_text(json.dumps(preflight,indent=2)+"\n",encoding="utf8")
        print(json.dumps(preflight,indent=2))
        return
    if os.name=="nt":
        npm="npm.cmd"
    else:
        npm="npm"
    with tempfile.TemporaryDirectory(prefix="chess-coach-whole-source-") as temp:
        destination=Path(temp)
        with zipfile.ZipFile(ZIP) as z:
            seen=set()
            for item in z.infolist():
                p=PurePosixPath(item.filename)
                if (p.is_absolute() or ".." in p.parts or "\\" in item.filename
                    or not item.filename.startswith(PREFIX) or item.filename in seen):
                    raise RuntimeError("Unsafe ZIP member: "+item.filename)
                seen.add(item.filename)
                target=destination.joinpath(*p.parts)
                if item.is_dir():
                    target.mkdir(parents=True,exist_ok=True)
                    continue
                target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(item) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src,dst)
        app=destination / "chess-coach-source"
        run([npm,"ci"],app)
        run([npm,"run","build:mobile"],app)
        run([npm,"exec","--","cap","sync","android"],app)
        gradle=app/"android"/("gradlew.bat" if os.name=="nt" else "gradlew")
        cmd=[str(gradle),"assembleDebug"]
        if os.name!="nt":
            cmd=["sh",str(gradle),"assembleDebug"]
        run(cmd,app/"android")
        apk=app/"android/app/build/outputs/apk/debug/app-debug.apk"
        if not apk.is_file():
            raise RuntimeError("Android Gradle finished but debug APK was not found")
        with zipfile.ZipFile(apk) as zip_apk:
            entries=set(zip_apk.namelist())
            missing=[entry for entry in REQUIRED_ASSETS if entry not in entries]
            if missing:
                raise RuntimeError("Debug APK missing Stockfish/license/piece assets: "+", ".join(missing[:12]))
            if any(name.endswith("illustrated-sheet.png") for name in entries):
                raise RuntimeError("Debug APK contains excluded Staunton sprite sheet")
            engine_hashes={}
            expected_npm = {
                "assets/public/engine/stockfish-19-lite-single.js": app/"node_modules/stockfish/bin/stockfish-19-lite-single.js",
                "assets/public/engine/stockfish-19-lite-single.wasm": app/"node_modules/stockfish/bin/stockfish-19-lite-single.wasm",
                "assets/public/engine/Stockfish-GPL-3.0.txt": app/"node_modules/stockfish/Copying.txt",
            }
            for entry in REQUIRED_ASSETS[:4]:
                engine_hashes[entry] = digest(zip_apk.read(entry))
            for entry, package_file in expected_npm.items():
                if zip_apk.read(entry)!=package_file.read_bytes():
                    raise RuntimeError("APK Stockfish file differs from exact npm-installed package: "+entry)
        APK_COPY.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(apk,APK_COPY)
        if digest(APK_COPY.read_bytes())!=digest(apk.read_bytes()):
            raise RuntimeError("Copied APK SHA-256 differs from freshly built APK")
        result={
            "status":"CLEAN_SOURCE_DEBUG_BUILD_PASS_NOT_RELEASE_APPROVAL",
            "debugApkPath":str(APK_COPY.relative_to(ROOT)).replace("\\","/"),
            "packagedAssetSha256":engine_hashes,
            "requiredAssetCount":len(REQUIRED_ASSETS),
            "engineMatchesInstalledNpmPackage":True,
            "qualifiedSourceZipSha256":digest(ZIP.read_bytes()),
            "baselineCommit":prior.get("gitCommit"),
            "debugApkSha256":digest(apk.read_bytes()),
            "debugApkBytes":apk.stat().st_size,
            "commands":RESULTS,
            "runStartedUtc":RUN_STARTED,
            "runCompletedUtc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "javaHomeConfigured":bool(os.environ.get("JAVA_HOME")),
            "androidSdkConfigured":bool(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")),
            "legalApproval":False,
            "signedReleaseAabAccepted":False,
        }
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
        print("PASS: isolated complete-source debug Android rebuild. No release bundle signed or distributed.")
        print("Evidence:",OUTPUT)
if __name__=="__main__":
    try:
        main()
    except (OSError,ValueError,KeyError,subprocess.SubprocessError,RuntimeError,zipfile.BadZipFile) as e:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(json.dumps({"status":"BLOCKED","error":str(e),"commands":RESULTS,"runStartedUtc":RUN_STARTED,
                                     "legalApproval":False,"signedReleaseAabAccepted":False},indent=2)+"\n",encoding="utf8")
        sys.exit("CLEAN SOURCE REBUILD FAILED: "+str(e))
