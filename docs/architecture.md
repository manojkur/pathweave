# Architecture

Status: implemented baseline, 2026-11-23.

## Boundaries

The Python web service serves a small accessible browser application and a JSON API. A separate worker shares a WAL-mode SQLite store. This is intentionally a single-owner deployment that can be reproduced without managed databases or a proprietary orchestration system.

The system has four distinct forms of state:

1. **Current teaching release:** domain graph, lessons, teaching instructions, and visual storyboards. It is content-addressed and sufficient to start a fresh tutor session.
2. **Learner evidence:** concept/dimension observations, assistance markers, approximate evidence estimates, preferences, and revisit dates. An unknown dimension stays unknown.
3. **Research records:** source metadata, simulations, descriptive analysis, candidate releases, job status, and review decisions.
4. **Optional conversation archive:** privately retained only when enabled. It is never replayed to rebuild the current teaching release. Disabling retention deletes saved conversation events.

A tutor request reads the active release, evidence for its selected concept, and at most eight explicitly supplied recent turns. Global event history is not an implicit prompt. A regression test verifies this independence. This does not mean learner memory is erased or that current conversational context is forbidden.

## Knowledge graph

`prerequisites` is an acyclic graph of choices for the authored prototype path. It is not a claim of universal logical necessity: prerequisites depend on learning objective and representation. Separate cross-edges describe analogy, application, generalization, and preview. The current planner orders prerequisite branches; it does not yet optimize a causal policy from human data.

## Cognitive simulator

`MemoryLearner` begins with no stored chunks. A study event adds a memory trace. Retrieval ranks relevant cue-matched chunks by recency/frequency activation and truncates to the working-buffer capacity. Activation decays with elapsed simulated ticks. Prerequisite readiness affects encoding, and repeated exposures reinforce retrieval.

It does not run a pretrained language model pretending to be a beginner. Its behavior follows explicit equations and is therefore limited by those equations. This makes assumptions testable, not automatically human-like. The current experiment measures simulated delayed retrieval only, not actual proof generation or semantic mathematical reasoning.

## Worker roles

- `research`: discovers public arXiv metadata; it does not silently treat abstracts as reviewed evidence.
- `analysis`: reads aggregate learner observations only when research consent is enabled. It establishes no causal effect.
- `experimentation`: runs deterministic paired-seed synthetic comparisons with equal exposure budgets.
- `narrative`: uses current lessons and curated source cards to propose a teaching policy and four-beat ODE storyboard. It cannot execute generated code or promote itself.

Jobs have persisted leases, next-run times, errors, and heartbeat status. Failed work retries. All model calls share a transactional daily reservation ledger across web and worker. OpenRouter model pricing is checked before reserving a conservative per-call ceiling; routing price caps and output caps constrain the request. Provider-side key spending limits provide an additional boundary. No other provider credentials are assumed.

Candidate promotion validates the graph, retains the previous snapshot, checks the candidate's base version, and atomically switches the current snapshot. The generated storyboard changes narrative text within an allowlisted renderer, not arbitrary Python or JavaScript. Automated educational-quality and factual gates remain future work; owner review is essential.

## Host embedding

A private or public host can consume a pinned release as a Git submodule or image. For `/learn/` embedding, strip the prefix at a reverse proxy and set:

```dotenv
APP_ORIGIN=https://your-host.example
BASE_PATH=/learn
HOST_URL=https://your-host.example/labs/learning
```

Use the same data volume for web and worker. Do not expose the service's backend port publicly in a hosted deployment. Application cookies are HTTP-only, same-site, revocable, and secure on HTTPS. The sole owner identity is configured externally; no host-specific identity or domain is in the code.

Hosts that protect the entire workspace can return an `X-Login-URL` response header selecting a neutral sign-in page. Only a same-origin target without embedded credentials is accepted. On authentication failure or sign-out, the browser clears the workspace and navigates to that page; standalone installations retain the built-in sign-in screen. Back/forward restoration rechecks the session before rendering. The host must enforce access at its proxy for every private page, API, and asset; client redirects alone are insufficient. If the host shares its session across routes, it must explicitly manage the root cookie path and revoke that shared session on logout.

## Optional library contract

The external library owns all files, extraction, full text, private reading notes, and rights metadata. Configure `LIBRARY_API_URL`, `LIBRARY_API_TOKEN`, `LIBRARY_WEB_URL`, and `LIBRARY_LABEL` only in private runtime settings.

The reference adapter expects:

- `GET /api/v1/pages?q=...&limit=30` → `{items:[{id,title,page_type}],total}`;
- `POST /api/v1/pages` with `title`, `page_type`, `content_text`, and `metadata` → a page record;
- page navigation at `/kb/{id}`.

Requests use a server-side bearer credential scoped to the intended library owner. Search results expose metadata, not storage credentials or signed file URLs. Save operations check exact titles before creation, making normal retries idempotent. Concurrent saves may still require server-side unique source-id enforcement in a multi-user deployment.

No browser-supplied URL can choose the connector destination. Only configured HTTPS endpoints receive its credential; redirects are not followed. Full-text ingestion should run inside the library's own authenticated ingestion API, with source URL, checksum, access/license basis, retrieval date, and review depth retained alongside the object.

A second optional read connection uses `LIBRARY_SECONDARY_API_URL` and `LIBRARY_SECONDARY_API_TOKEN`. Search combines metadata across both; new project records are written to the primary library. The experimentation role maintains a current research notebook in that library with the release id, source repository, workspace link, and synthetic results, without learner records. Library-side agents can consume that page as structured current state.

Tutor and narrative requests can retrieve text from the lesson's cited sources through authenticated `GET /api/v1/pages/{id}` responses. The library's `extracted_text` field supplies the reading; a catalog summary is not treated as the underlying book. Each response is capped at 4 MiB, and lexical selection supplies at most two 1,200-character passages to the model. Full text is transient server memory and is never added to teaching snapshots, conversation exports, or git. The tutor returns only source-reference metadata to the browser. Source extraction is unreviewed, and ranking is lexical rather than a validated relevance measure; original PDFs remain the authority. A library outage does not block ordinary tutoring.

## AI backend selection

OpenRouter is the default. An optional private machine can provide an OpenAI-compatible `/v1` endpoint through `LOCAL_AI_BASE_URL`. The owner can select its served model in the profile settings after a connection check succeeds. Cloud credentials are never sent to that endpoint. A failed local connection does not replace the current backend. The selected backend is shared by tutoring and narrative research; local inference consumes a call reservation with zero monetary reservation. Provider availability is distinct from scientific validation.

The owner can explicitly opt in to copying a verified OpenRouter key and selected model to the configured knowledge workspaces through their encrypted credential APIs. This option is off by default. Only credentials labeled for this connection are replaced; unrelated keys remain separate. Model tiers in those workspaces are set to the selected model. Removing the local saved key does not revoke separately stored workspace credentials.
