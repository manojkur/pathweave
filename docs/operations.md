# Operations

Status: current baseline, 2026-11-23.

Use `uv.lock` and `uv sync --frozen` for reproducible Python dependencies. The Docker image runs as an unprivileged user. Persist `/data`, share it between web and worker, and restrict file access. Set production `APP_ORIGIN` exactly to the HTTPS host. Set `BASE_PATH` to the mounted path or an empty string. Terminate HTTPS at the host proxy.

The web liveness probe is `/health`. The worker health probe is `python -m learninglab.worker --health`, using an actual worker heartbeat. The lab UI reports role status, error class, recent result, and whether the worker is connected. Never treat a waiting-for-provider role as successful model research.

Source research retries every 15 minutes on failure. Normal cycles default to six hours. The process polls on a short cadence, and persists leases so a restart can resume stale work. There is no uncontrolled self-promotion or model-generated code execution. No future Codex automation is needed: this worker is part of the deployed application.

Back up the data volume consistently using SQLite's backup API or stop the two services during a volume copy. Do not publish backups. Retain the prior image and snapshot before upgrades. Current teaching snapshots have content-addressed versions and remain in the store after promotion. A future UI can expose rollback; an operator can restore a reviewed saved release to the `snapshot` key with an audited maintenance procedure.

Provider inference requires an owner-supplied key. The owner settings form verifies it against OpenRouter before saving it. Default budgets reserve at most 40 requests and $2 per UTC day, with a $0.05 ceiling per request. Failed requests still consume their reservation, conservatively. Inspect provider-side usage as the authority for billing. Configure an additional provider-side key limit for a direct spending cap.

External library credentials are deployment secrets. Source files stay in that library's object store; only references are copied through this app. The web process never accepts an arbitrary backend URL from a browser request.
