#!/usr/bin/env python3
"""Offline fail-closed regression for verify-clean-source-build.py preflight.

Only synthetic, non-copyrighted dummy ZIPs are generated. Never invokes npm,
Gradle, Android signing, or the real private qualification archive.
"""
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).with_name("verify-clean-source-build.py")
BASELINE = "1d3d85d6f3e889beda0a97c4f59e29f51902f9c2"
PREFIX = "chess-coach-source/"
def digest(data):
    return hashlib.sha256(data).hexdigest()

class CleanSourcePreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="source-preflight-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        (self.root/"scripts").mkdir()
        shutil.copyfile(SCRIPT,self.root/"scripts"/SCRIPT.name)
        (self.root/"release-sources").mkdir()
        (self.root/"artifacts").mkdir()
        (self.root/"android-sdk").mkdir()
        self.zip=self.root/"release-sources/chess-coach-complete-source-candidate.zip"
        self.records=[{"path":f"dummy/source_{i:03d}.txt"} for i in range(371)]
        self.nested=b"synthetic-stockfish-source-not-real-licensed-content"
        self.members={PREFIX+x["path"]:f"dummy-{i}".encode() for i,x in enumerate(self.records)}
        self.members[PREFIX+"upstream/stockfish-corresponding-source.tar.gz"]=self.nested
        self.write_fixture()

    def write_fixture(self,extra=None,removed=None,zipinfo_extra=None):
        entries=dict(self.members)
        if removed: entries.pop(removed,None)
        manifest={
            "gitCommit":BASELINE,
            "trackedFileCount":371,
            "stockfishSourceSha256":digest(self.nested),
            "files":[{**record,"sha256":digest(self.members[PREFIX+record["path"]]),
                      "sizeBytes":len(self.members[PREFIX+record["path"]])}
                     for record in self.records],
        }
        entries[PREFIX+"SOURCE_MANIFEST.json"]=(json.dumps(manifest)+"\n").encode()
        if extra: entries.update(extra)
        with zipfile.ZipFile(self.zip,"w",compression=zipfile.ZIP_DEFLATED) as z:
            for path,data in entries.items():
                z.writestr(path,data)
            if zipinfo_extra:
                info,data=zipinfo_extra
                z.writestr(info,data)
        verification={
            "status":"COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING",
            "gitCommit":BASELINE,"trackedFileCount":371,
            "archiveSha256":digest(self.zip.read_bytes()),
            "stockfishSourceSha256":digest(self.nested),
            "errors":[],
        }
        (self.root/"artifacts/chess-coach-complete-source-verification.json").write_text(json.dumps(verification))

    def execute(self):
        with (
            patch.object(sys,"argv",[str(self.root/"scripts"/SCRIPT.name),"--preflight-only"]),
            patch.dict(os.environ,{"ANDROID_HOME":str(self.root/"android-sdk")}),
            patch("shutil.which",return_value="/mock/tool"),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            try:
                runpy.run_path(str(self.root/"scripts"/SCRIPT.name),run_name="__main__")
                return 0
            except SystemExit as exc:
                return exc.code

    def test_valid_fixture_preflight_does_not_run_android(self):
        self.assertEqual(self.execute(),0)
        result=json.loads((self.root/"artifacts/chess-coach-clean-source-preflight.json").read_text())
        self.assertEqual(result["status"],"CLEAN_SOURCE_PREFLIGHT_PASS_BUILD_PENDING")
        self.assertEqual(result["trackedFileCount"],371)
        self.assertEqual(result["commands"],[])
        self.assertFalse((self.root/"artifacts/chess-coach-clean-source-build.json").exists())

    def test_failed_preflight_keeps_existing_build_report(self):
        report=self.root/"artifacts/chess-coach-clean-source-build.json"
        report.write_text('{"status":"prior-debug-build-evidence"}')
        verify=self.root/"artifacts/chess-coach-complete-source-verification.json"
        data=json.loads(verify.read_text())
        data["archiveSha256"]="f"*64
        verify.write_text(json.dumps(data))
        self.assertNotEqual(self.execute(),0)
        self.assertEqual(json.loads(report.read_text())["status"],"prior-debug-build-evidence")
        blocked=json.loads((self.root/"artifacts/chess-coach-clean-source-preflight.json").read_text())
        self.assertEqual(blocked["status"],"BLOCKED")

    def test_bad_archive_checksum_blocks(self):
        verify=self.root/"artifacts/chess-coach-complete-source-verification.json"
        report=json.loads(verify.read_text())
        report["archiveSha256"]="0"*64
        verify.write_text(json.dumps(report))
        self.assertNotEqual(self.execute(),0)

    def test_missing_source_member_blocks(self):
        self.write_fixture(removed=PREFIX+"dummy/source_006.txt")
        self.assertNotEqual(self.execute(),0)

    def test_missing_nested_stockfish_archive_blocks(self):
        self.write_fixture(removed=PREFIX+"upstream/stockfish-corresponding-source.tar.gz")
        self.assertNotEqual(self.execute(),0)

    def test_zip_traversal_blocks(self):
        self.write_fixture(extra={PREFIX+"../unsafe.txt":b"attempt"})
        self.assertNotEqual(self.execute(),0)

    def test_zip_symlink_blocks(self):
        info=zipfile.ZipInfo(PREFIX+"dummy/stealth-link")
        info.create_system=3
        info.external_attr=(0o120777 <<16)
        self.write_fixture(zipinfo_extra=(info,b"/etc/passwd"))
        self.assertNotEqual(self.execute(),0)

    def test_modified_tracked_file_without_updated_manifest_blocks(self):
        self.write_fixture(extra={PREFIX+"dummy/source_010.txt":b"tampered-source-file"})
        self.assertNotEqual(self.execute(),0)

    def test_bad_tracked_file_hash_blocks(self):
        self.write_fixture(extra={PREFIX+"dummy/source_000.txt":b"different-source"})
        self.assertNotEqual(self.execute(),0)

    def test_tampered_nested_archive_blocks(self):
        self.write_fixture(extra={PREFIX+"upstream/stockfish-corresponding-source.tar.gz":b"altered"})
        self.assertNotEqual(self.execute(),0)

if __name__=="__main__":
    unittest.main()
