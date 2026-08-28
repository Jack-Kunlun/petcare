#!/usr/bin/env python3
"""Atomically update managed production settings and remove deprecated keys."""

import os
import re
import stat
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

MANAGED_KEYS = (
    "PUBLIC_MEDIA_STORAGE_PROVIDER",
    "TENCENT_COS_SECRET_ID",
    "TENCENT_COS_SECRET_KEY",
    "TENCENT_COS_BUCKET",
    "TENCENT_COS_REGION",
    "TENCENT_COS_PUBLIC_BASE_URL",
)
REMOVED_KEYS = {"DEFAULT_ADMIN_PHONE"}


def fail(message: str) -> None:
    raise SystemExit(message)


def read_updates(path: Path) -> dict[str, str]:
    raw = path.read_text(encoding="utf-8")
    if "\r" in raw or "\0" in raw:
        fail("public media update file contains control characters")

    updates: dict[str, str] = {}
    for line in raw.splitlines():
        key, separator, value = line.partition("=")
        if not separator or key not in MANAGED_KEYS:
            fail("public media update file contains an invalid key")
        if key in updates:
            fail(f"public media update file contains a duplicate key: {key}")
        updates[key] = value

    missing = set(MANAGED_KEYS) - updates.keys()
    if missing:
        fail("public media update file is incomplete")

    if updates["PUBLIC_MEDIA_STORAGE_PROVIDER"] != "tencent-cos":
        fail("PUBLIC_MEDIA_STORAGE_PROVIDER must be tencent-cos")
    if not re.fullmatch(r"[A-Za-z0-9_+/=-]{16,128}", updates["TENCENT_COS_SECRET_ID"]):
        fail("TENCENT_COS_SECRET_ID has an invalid format")
    if not re.fullmatch(r"[A-Za-z0-9_+/=-]{16,128}", updates["TENCENT_COS_SECRET_KEY"]):
        fail("TENCENT_COS_SECRET_KEY has an invalid format")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*-\d{10,}", updates["TENCENT_COS_BUCKET"]):
        fail("TENCENT_COS_BUCKET has an invalid format")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)+", updates["TENCENT_COS_REGION"]):
        fail("TENCENT_COS_REGION has an invalid format")

    public_base_url = updates["TENCENT_COS_PUBLIC_BASE_URL"]
    if public_base_url:
        parsed = urlsplit(public_base_url)
        if (
            parsed.scheme != "https"
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            fail("TENCENT_COS_PUBLIC_BASE_URL must be a credential-free HTTPS URL")

    return updates


def update_env(target: Path, updates: dict[str, str]) -> None:
    metadata = target.lstat()
    if not stat.S_ISREG(metadata.st_mode) or (
        os.name != "nt" and stat.S_IMODE(metadata.st_mode) != 0o600
    ):
        fail("production environment file must be a regular file with mode 0600")

    output: list[str] = []
    seen: set[str] = set()
    for line in target.read_text(encoding="utf-8").splitlines():
        key, separator, _value = line.partition("=")
        if separator and key in REMOVED_KEYS:
            continue
        if separator and key in MANAGED_KEYS:
            if key in seen:
                fail(f"production environment file contains a duplicate key: {key}")
            seen.add(key)
            output.append(f"{key}={updates[key]}")
        else:
            output.append(line)

    for key in MANAGED_KEYS:
        if key not in seen:
            output.append(f"{key}={updates[key]}")

    descriptor, temporary_name = tempfile.mkstemp(prefix=".env.public-media.", dir=target.parent)
    try:
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, 0o600)
        else:
            os.chmod(temporary_name, 0o600)
        if hasattr(os, "fchown"):
            os.fchown(descriptor, metadata.st_uid, metadata.st_gid)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write("\n".join(output) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, target)
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        Path(temporary_name).unlink(missing_ok=True)
        raise


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: update-public-media-env.py <target-env> <updates-env>")

    target = Path(sys.argv[1])
    updates = Path(sys.argv[2])
    update_env(target, read_updates(updates))
    print("public media environment updated")


if __name__ == "__main__":
    main()
