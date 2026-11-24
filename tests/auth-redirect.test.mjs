import { test } from "node:test";
import assert from "node:assert/strict";
import { hostSignInTarget } from "../learninglab/static/auth-redirect.mjs";

test("a host can select its own neutral sign-in page", () => {
  assert.equal(hostSignInTarget("/sign-in", "https://host.example"), "/sign-in");
  assert.equal(hostSignInTarget("https://host.example/sign-in", "https://host.example"), "/sign-in");
  assert.equal(hostSignInTarget(null, "https://host.example"), "");
});

test("host sign-in cannot redirect credentials to another origin", () => {
  for (const raw of ["https://attacker.example", "//attacker.example", "/\\attacker.example", "javascript:alert(1)", "https://name:secret@host.example/"]) {
    assert.equal(hostSignInTarget(raw, "https://host.example"), "");
  }
});
