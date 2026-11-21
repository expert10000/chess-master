#!/usr/bin/env python3
"""Offline synthetic tests for the independent clean-debug-APK review.

No real Stockfish files, private source archive, Android tools, or signing keys.
Tests deliberately forged result reports and synthetic APK ZIPs.
"""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import runpy
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT=Path(__file__).with_name("review-clean-source-build.py")
COMMIT="1d3d85d6f3e889beda0a97c4f59e29f51902f9c2"
def sha(data): return hashlib.sha256(data).hexdigest()

class DebugApkReviewRegression(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory(prefix="apk-review-test-")
        self.addCleanup(tmp.cleanup)
        self.root=Path(tmp.name)
        (self.root/"scripts").mkdir()
        shutil.copyfile(SCRIPT,self.root/"scripts"/SCRIPT.name)
        (self.root/"artifacts").mkdir()
        (self.root/"release-sources").mkdir()
        self.apk=self.root/"artifacts/chess-coach-clean-source-debug.apk"
        self.source=self.root/"release-sources/chess-coach-complete-source-candidate.zip"
        self.source.write_bytes(b"synthetic qualified ZIP fixture, not actual release source")
        self.verified=self.root/"artifacts/chess-coach-complete-source-verification.json"
        self.report=self.root/"artifacts/chess-coach-clean-source-build.json"
        self.members={
            "assets/public/licenses.html":b"<h1>synthetic licence</h1>",
            "assets/public/engine/Stockfish-GPL-3.0.txt":b"synthetic GPL test fixture",
            "assets/public/engine/stockfish-19-lite-single.js":b"synthetic JS",
            "assets/public/engine/stockfish-19-lite-single.wasm":b"synthetic WASM",
        }
        for style in ("spatial","fantasy","chessnut"):
            for side in ("w","b"):
                for piece in ("P","N","B","R","Q","K"):
                    name=f"assets/public/pieces/{style}/{side}{piece}.svg"
                    self.members[name]=(name+" synthetic").encode()
        self.write_fixture()

    def write_fixture(self):
        with zipfile.ZipFile(self.apk,"w",zipfile.ZIP_DEFLATED) as archive:
            for name,value in self.members.items():
                archive.writestr(name,value)
        apkdata=self.apk.read_bytes()
        qualified={
            "status":"COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING",
            "archiveSha256":sha(self.source.read_bytes()),
            "gitCommit":COMMIT,
            "errors":[],
        }
        self.verified.write_text(json.dumps(qualified))
        report={
            "status":"CLEAN_SOURCE_DEBUG_BUILD_PASS_NOT_RELEASE_APPROVAL",
            "baselineCommit":COMMIT,
            "qualifiedSourceZipSha256":sha(self.source.read_bytes()),
            "debugApkSha256":sha(apkdata),
            "debugApkBytes":len(apkdata),
            "engineMatchesInstalledNpmPackage":True,
            "packagedAssetSha256":{n:sha(self.members[n]) for n in list(self.members)[:4]},
            "requiredAssetCount":40,
            "commands":[{"command":c,"exitCode":0} for c in ("npm ci","npm run build:mobile","npm exec -- cap sync android","gradlew assembleDebug")],
            "legalApproval":False,
            "signedReleaseAabAccepted":False,
        }
        self.report.write_text(json.dumps(report))

    def run_review(self):
        with patch.object(sys,"argv",[str(self.root/"scripts"/SCRIPT.name)]),contextlib.redirect_stdout(io.StringIO()):
            try:
                runpy.run_path(str(self.root/"scripts"/SCRIPT.name),run_name="__main__")
                return 0
            except SystemExit as e:
                return e.code

    def assert_blocked(self):
        self.assertNotEqual(self.run_review(),0)
        report=json.loads((self.root/"artifacts/chess-coach-clean-source-acceptance.json").read_text())
        self.assertEqual(report["status"],"BLOCKED")
        self.assertTrue(report["errors"])

    def test_valid_synthetic_apk(self):
        self.assertEqual(self.run_review(),0)
        report=json.loads((self.root/"artifacts/chess-coach-clean-source-acceptance.json").read_text())
        self.assertEqual(report["status"],"CLEAN_SOURCE_DEBUG_ACCEPTED_GPL_PENDING")
        self.assertIs(report["legalApproval"],False)
        self.assertEqual(report["checkedAssetCount"],40)

    def test_tampered_apk_blocks(self):
        with self.apk.open("ab") as stream: stream.write(b"changed-after-build")
        self.assert_blocked()

    def test_missing_engine_blocks(self):
        self.members.pop("assets/public/engine/stockfish-19-lite-single.wasm")
        self.write_fixture()
        self.assert_blocked()

    def test_excluded_stanton_sheet_blocks(self):
        self.members["assets/public/pieces/illustrated-sheet.png"]=b"unverified sprite"
        self.write_fixture()
        self.assert_blocked()

    def test_false_engine_match_claim_blocks(self):
        r=json.loads(self.report.read_text())
        r["engineMatchesInstalledNpmPackage"]=False
        self.report.write_text(json.dumps(r))
        self.assert_blocked()

    def test_failed_gradle_blocks(self):
        r=json.loads(self.report.read_text())
        r["commands"][-1]["exitCode"]=1
        self.report.write_text(json.dumps(r))
        self.assert_blocked()

    def test_wrong_baseline_blocks(self):
        r=json.loads(self.report.read_text())
        r["baselineCommit"]="0"*40
        self.report.write_text(json.dumps(r))
        self.assert_blocked()

    def test_illegal_release_approval_claim_blocks(self):
        r=json.loads(self.report.read_text())
        r["legalApproval"]=True
        self.report.write_text(json.dumps(r))
        self.assert_blocked()

if __name__=="__main__":
    unittest.main()
