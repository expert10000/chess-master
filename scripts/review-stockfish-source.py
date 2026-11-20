#!/usr/bin/env python3
"""Inspect Stockfish corresponding-source archive + formal build evidence independently.

Evidence review only. No GPL legal approval, attestation mutation or Android sync.
"""
import hashlib
import json
import re
import sys
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "release-sources/stockfish-corresponding-source.tar.gz"
EVIDENCE = ROOT / "artifacts/stockfish-source-rebuild-evidence.json"
LOCK = ROOT / "package-lock.json"
NETWORK = "nn-61e7af4bb97d.nnue"
PINNED = "0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6"
REQUIRED = [
    "build.js", "Copying.txt", "scripts/net.sh", "src/Makefile",
    "src/evaluate.h", "src/emscripten/wasm-makefile.mk",
    "src/engine.cpp", "src/evaluate.cpp", "src/" + NETWORK,
]
OUTPUT = ROOT / "artifacts/stockfish-source-review.json"
issues = []
sha = lambda data: hashlib.sha256(data).hexdigest()
def load(path):
    return json.loads(path.read_text(encoding="utf-8"))
def file(path):
    if not path.is_file():
        issues.append("File missing: " + str(path))
        return None
    return path.read_bytes()

archive_bytes = file(SOURCE)
evidence_bytes = file(EVIDENCE)
lock_bytes = file(LOCK)
engine = {}
for name in ("stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"):
    b = file(ROOT / "node_modules/stockfish/bin" / name)
    engine[name] = {"sha256": sha(b), "sizeBytes": len(b)} if b is not None else None

report = {
    "purpose": "Independent source-package and rebuild evidence technical preflight; NOT legal clearance",
    "status": "BLOCKED",
    "sourceArchiveSha256": sha(archive_bytes) if archive_bytes is not None else None,
    "sourceFiles": 0,
    "sourceSizeBytes": len(archive_bytes) if archive_bytes is not None else None,
    "networkSha256": None,
    "networkSha256PrefixMatchesName": False,
    "rebuild": None,
    "engine": engine,
    "issues": issues,
    "legalGplScopeApproved": False,
}
if archive_bytes:
    try:
        with tarfile.open(SOURCE, "r:gz") as t:
            members = t.getmembers()
            roots = {PurePosixPath(m.name).parts[0] for m in members if m.name}
            if len(roots) != 1:
                issues.append("Unexpected archive root count")
            else:
                prefix = next(iter(roots))
                indexed = {m.name.rstrip("/"): m for m in members}
                for rel in REQUIRED:
                    key = prefix + "/" + rel
                    if key not in indexed or not indexed[key].isfile():
                        issues.append("Missing source archive member: " + rel)
                for m in members:
                    p = PurePosixPath(m.name)
                    if p.is_absolute() or ".." in p.parts or "\\" in m.name:
                        issues.append("Unsafe archive name: " + m.name)
                    if m.issym() and m.name != prefix + "/examples/src":
                        issues.append("Unexpected source archive symlink: " + m.name)
                    if not (m.isfile() or m.isdir() or m.issym()):
                        issues.append("Unexpected source archive entry type: " + m.name)
                report["sourceFiles"] = sum(m.isfile() for m in members)
                key = prefix + "/src/" + NETWORK
                if key in indexed and indexed[key].isfile():
                    network = t.extractfile(indexed[key]).read()
                    report["networkSha256"] = sha(network)
                    report["networkSha256PrefixMatchesName"] = sha(network).startswith("61e7af4bb97d")
                    if not report["networkSha256PrefixMatchesName"]:
                        issues.append("Lite NNUE content hash not consistent with network filename")
    except (OSError, tarfile.TarError, ValueError) as exc:
        issues.append("Unable to inspect source archive: " + str(exc))

if evidence_bytes and lock_bytes:
    try:
        evidence = json.loads(evidence_bytes)
        lock = json.loads(lock_bytes)
        version = lock["packages"]["node_modules/stockfish"]["version"]
        compares = evidence.get("comparisons", [])
        report["rebuild"] = {
            "reportedStatus": evidence.get("status"),
            "packageVersion": evidence.get("packageVersion"),
            "sourceArchiveSha256": evidence.get("sourceArchiveSha256"),
            "emscriptenVersion": evidence.get("emscriptenVersion"),
            "postprocessWorkaround": evidence.get("postprocessWorkaround"),
        }
        if version != "19.0.1" or evidence.get("packageVersion") != version:
            issues.append("Stockfish npm lock/evidence version mismatch")
        if evidence.get("status") != "REPRODUCIBLE_EXACT":
            issues.append("Formal evidence does not say REPRODUCIBLE_EXACT")
        if evidence.get("sourceArchiveSha256") != report["sourceArchiveSha256"]:
            issues.append("Evidence source archive SHA does not match actual archive")
        if not re.search(r"6\.0\.9", str(evidence.get("emscriptenVersion", ""))):
            issues.append("Emscripten 6.0.9 not recorded in rebuild evidence")
        for name, actual in engine.items():
            matches = [c for c in compares if c.get("file") == name]
            if len(matches) != 1 or actual is None:
                issues.append("Missing rebuilt/npm evidence for: " + name)
                continue
            c = matches[0]
            if not c.get("exactMatch") or c.get("rebuiltSha256") != actual["sha256"] or c.get("npmSha256") != actual["sha256"] or c.get("rebuiltBytes") != actual["sizeBytes"] or c.get("npmBytes") != actual["sizeBytes"]:
                issues.append("Rebuilt/npm artifact hash or byte mismatch: " + name)
        workaround = evidence.get("postprocessWorkaround")
        if workaround and (workaround.get("kind") != "windows-symlink-alias-copy" or workaround.get("exactReplacementCount") != 1 or workaround.get("sourceArchiveUnmodified") is not True):
            issues.append("Unrecognized post-build Windows workaround")
    except (ValueError, KeyError, TypeError) as exc:
        issues.append("Invalid rebuild/lock evidence: " + str(exc))

attestation = ROOT / "compliance/stockfish-source-attestation.json"
if attestation.is_file():
    try:
        a = load(attestation)
        report["attestationStillUnverified"] = not bool(a.get("binaryMatchesSourceVerified"))
        if a.get("archiveSha256") != report["sourceArchiveSha256"]:
            issues.append("Local draft attestation archive hash mismatch")
        if a.get("sourceRevision") != PINNED:
            issues.append("Local draft source revision mismatch")
        if report["networkSha256"] and a.get("liteNetworkSha256") != report["networkSha256"]:
            issues.append("Local draft NNUE hash mismatch")
    except (OSError, ValueError):
        issues.append("Local attestation draft unreadable")
else:
    report["attestationStillUnverified"] = True

report["status"] = "TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING" if not issues else "BLOCKED"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("Technical preflight:", report["status"])
print("Source files:", report["sourceFiles"])
print("Report:", OUTPUT)
for item in issues:
    print("ISSUE:", item)
print("Never use this report alone to change GPL license approval or submit to Google Play.")
sys.exit(1 if issues else 0)
