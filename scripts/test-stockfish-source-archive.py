#!/usr/bin/env python3
"""Regression for Windows-safe archive handling, using a synthetic tar fixture."""
import importlib.util
from pathlib import Path
import tarfile
import tempfile
import unittest
import io

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("stockfish_source_archive", ROOT / "stockfish-source-archive.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ArchiveRegression(unittest.TestCase):
    def test_preserves_optional_example_symlink_and_extracts_without_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            upstream = root / "tag.tar.gz"
            prepared = root / "candidate.tar.gz"
            nnue = root / mod.NET_NAME
            nnue.write_bytes(b"example network input for archive layout test")
            prefix = "stockfish.js-audit"
            with tarfile.open(upstream, "w:gz") as archive:
                for name in mod.REQUIRED:
                    payload = (name + "\n").encode()
                    info = tarfile.TarInfo(prefix + "/" + name)
                    info.size = len(payload)
                    archive.addfile(info, io.BytesIO(payload))
                example = tarfile.TarInfo(prefix + "/examples/src")
                example.type = tarfile.SYMTYPE
                example.linkname = "../src"
                archive.addfile(example)
            mod.assemble(upstream, nnue, prepared)
            with tarfile.open(prepared, "r:gz") as archive:
                items = {item.name: item for item in archive.getmembers()}
                self.assertTrue(items[prefix + "/examples/src"].issym())
                self.assertEqual(archive.extractfile(prefix + "/src/" + mod.NET_NAME).read(), nnue.read_bytes())
            extracted = root / "extracted"
            mod.extract_for_build(prepared, extracted)
            self.assertTrue((extracted / prefix / "build.js").is_file())
            self.assertFalse((extracted / prefix / "examples" / "src").exists())
            self.assertEqual((extracted / prefix / "src" / mod.NET_NAME).read_bytes(), nnue.read_bytes())


if __name__ == "__main__":
    unittest.main()
