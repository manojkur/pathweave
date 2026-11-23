"""Small, durable single-owner store. Learner records never belong in git."""

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path


def directory():
    path = Path(os.environ.get("DATA_DIR", "runtime"))
    path.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def db():
    con = sqlite3.connect(directory() / "learning.sqlite3", timeout=30)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions
          (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS limits
          (key TEXT PRIMARY KEY, count INTEGER NOT NULL, amount REAL NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS attempts
          (id TEXT PRIMARY KEY, concept TEXT NOT NULL, dimension TEXT NOT NULL,
           payload TEXT NOT NULL, created REAL NOT NULL, answered INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS events
          (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs
          (role TEXT PRIMARY KEY, status TEXT NOT NULL, heartbeat REAL, next_run REAL NOT NULL DEFAULT 0,
           result TEXT, error TEXT);
        CREATE TABLE IF NOT EXISTS proposals
          (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created REAL NOT NULL);
        """)


def get(key, default=None):
    with db() as con:
        row = con.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return json.loads(row[0]) if row else default


def put(key, value):
    with db() as con:
        con.execute("INSERT OR REPLACE INTO kv VALUES (?,?)", (key, json.dumps(value)))


def event(kind, payload):
    with db() as con:
        con.execute(
            "INSERT INTO events(kind,payload,created) VALUES (?,?,?)",
            (kind, json.dumps(payload), time.time()),
        )
