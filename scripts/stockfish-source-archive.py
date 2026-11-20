#!/usr/bin/env python3
"""Safely assemble/extract the pinned Stockfish.js source on Windows.

The upstream Git archive includes examples/src, a symlink. Building the source
candidate must not require Windows symlink privileges. The assembled archive
PRESERVES that symlink; extracting for compilation skips only that optional
example link. All other links are rejected in the verification extraction.
"""
import argparse
import copy
import io
import os
from pathlib import Path, PurePosixPath
import sys
import tarfile

NET_NAME = "nn-61e7af4bb97d.nnue"
REQUIRED = (
    "build.js", "Copying.txt", "scripts/net.sh",
    "src/Makefile", "src/evaluate.h", "src/emscripten/wasm-makefile.mk",
)


def checked_name(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or "\\" in name or any(p in ("", ".", "..") for p in path.parts):
        raise ValueError("Unsafe tar entry: " + repr(name))
    return path


def inspect(tar):
    members = tar.getmembers()
    for member in members:
        checked_name(member.name)
    roots = {checked_name(m.name).parts[0] for m in members}
    if len(roots) != 1:
        raise ValueError("Expected exactly one source root, found " + repr(roots))
    root = next(iter(roots))
    present = {m.name.rstrip("/") for m in members if m.isfile()}
    missing = [root + "/" + p for p in REQUIRED if root + "/" + p not in present]
    if missing:
        raise ValueError("Missing required source inputs: " + repr(missing))
    return root, members


def assemble(source_path, nnue_path, output_path):
    source_path, nnue_path, output_path = map(Path, (source_path, nnue_path, output_path))
    data_size = nnue_path.stat().st_size
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(source_path, "r:gz") as original, tarfile.open(output_path, "w:gz", format=tarfile.PAX_FORMAT) as result:
        root, members = inspect(original)
        target = root + "/src/" + NET_NAME
        if any(m.name.rstrip("/") == target for m in members):
            raise ValueError("Network already exists in tagged source; do not overwrite it")
        for member in members:
            if not (member.isfile() or member.isdir() or member.issym()):
                raise ValueError("Unsupported source entry type: " + member.name)
            fileobj = original.extractfile(member) if member.isfile() else None
            result.addfile(copy.copy(member), fileobj)
        info = tarfile.TarInfo(target)
        info.size = data_size
        info.mode = 0o644
        with nnue_path.open("rb") as network:
            result.addfile(info, network)
    print("Assembled corresponding-source candidate:", output_path)
    print("Preserved upstream symbolic links without creating Windows symlinks.")


def extract_for_build(archive_path, destination):
    archive_path, destination = Path(archive_path), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    omitted = []
    with tarfile.open(archive_path, "r:gz") as archive:
        root, members = inspect(archive)
        for member in members:
            path = checked_name(member.name)
            if member.issym():
                if member.name == root + "/examples/src":
                    omitted.append((member.name, member.linkname))
                    continue
                raise ValueError("Unexpected symlink in source archive: " + member.name)
            if not (member.isdir() or member.isfile()):
                raise ValueError("Unsupported source entry type: " + member.name)
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as src, target.open("wb") as dst:
                    import shutil
                    shutil.copyfileobj(src, dst)
    if omitted:
        for name, value in omitted:
            print("Skipped optional example symlink during Windows build extraction:", name, "->", value)
    print("Extracted build inputs to:", destination)


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_subparsers(dest="mode", required=True)
    a = modes.add_parser("assemble")
    for field in ("upstream_tar", "lite_nnue", "output_tar"):
        a.add_argument(field)
    b = modes.add_parser("extract")
    b.add_argument("source_tar")
    b.add_argument("destination")
    args = parser.parse_args()
    if args.mode == "assemble":
        assemble(args.upstream_tar, args.lite_nnue, args.output_tar)
    else:
        extract_for_build(args.source_tar, args.destination)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, tarfile.TarError) as error:
        sys.exit("SOURCE ARCHIVE ERROR: " + str(error))
