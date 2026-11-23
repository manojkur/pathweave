"""Print a salted hash, never the supplied password."""

import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from learninglab.auth import password_hash

if __name__ == "__main__":
    first = getpass.getpass("Owner password (at least 16 characters): ")
    if len(first) < 16 or first != getpass.getpass("Repeat password: "):
        raise SystemExit("Passwords must match and have at least 16 characters")
    print("OWNER_PASSWORD_HASH='" + password_hash(first) + "'")
