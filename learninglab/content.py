"""Typed connections and original pilot lessons; a map is not course coverage."""

import copy
import hashlib
import json
from pathlib import Path

DATA = Path(__file__).parent / "data"
DIMENSIONS = ["intuition", "representation", "formal", "proof", "transfer"]


def read(name):
    return json.loads((DATA / name).read_text())


def catalog():
    return read("mathematics.json")


def validate_snapshot(snapshot):
    nodes = snapshot["concepts"]
    ids = {n["id"] for n in nodes}
    if len(ids) != len(nodes) or not ids:
        raise ValueError("Concept ids must be unique and nonempty")
    graph = {n["id"]: n.get("prerequisites", []) for n in nodes}
    visited, active = set(), set()

    def walk(key):
        if key not in ids:
            raise ValueError("Missing prerequisite")
        if key in active:
            raise ValueError("Prerequisite cycle")
        if key in visited:
            return
        active.add(key)
        for parent in graph[key]:
            walk(parent)
        active.remove(key)
        visited.add(key)

    for key in ids:
        walk(key)
    for edge in snapshot.get("connections", []):
        if edge["from"] not in ids or edge["to"] not in ids:
            raise ValueError("Unknown connection endpoint")
        if edge["kind"] not in {"analogy", "application", "generalization", "preview"}:
            raise ValueError("Unknown connection type")
    if not isinstance(snapshot.get("tutor_policy"), str) or len(snapshot["tutor_policy"]) > 6000:
        raise ValueError("A bounded tutor policy is required")
    return snapshot


def snapshot_id(snapshot):
    payload = copy.deepcopy(snapshot)
    payload.pop("version", None)
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:16]


def initial_snapshot():
    snapshot = validate_snapshot(catalog())
    snapshot["version"] = snapshot_id(snapshot)
    return snapshot


def pathway(snapshot, goal, profile, strategy="connected"):
    nodes = {n["id"]: n for n in snapshot["concepts"]}
    if goal not in nodes:
        raise ValueError("Unknown learning goal")
    needed, ordered = set(), []

    def visit(key):
        if key in needed:
            return
        needed.add(key)
        parents = list(nodes[key].get("prerequisites", []))
        if strategy == "proof-first":
            parents.sort(key=lambda p: "proof" not in p and "logic" not in p)
        for parent in parents:
            visit(parent)
        ordered.append(key)

    visit(goal)
    results = []
    for key in ordered:
        scores = profile.get("skills", {}).get(key, {})
        evidence = sum(v.get("observations", 0) for v in scores.values())
        mean = sum(v.get("mean", 0.5) for v in scores.values()) / max(1, len(scores))
        results.append(
            {
                **nodes[key],
                "state": "review" if evidence and mean >= 0.8 else "diagnose",
                "evidence_count": evidence,
            }
        )
    return results
