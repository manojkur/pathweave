# Pathweave

**An open research platform for connected learning. Mathematics first, other fields next.**

Pathweave investigates how people can build durable understanding through better sequences, explanations, practice, and connections between ideas. It combines a learning workspace with an inspectable research system.

This is a working **research preview**, not a validated replacement for a mathematics education. A map extending toward research is not a completed frontier curriculum. Synthetic learners generate hypotheses; only appropriate human studies can establish human learning benefits.

## Run it

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/), or Docker Compose.

```sh
uv sync
cp .env.example .env
uv run python scripts/create_owner.py
```

Put the resulting salted password hash in `.env`, set `OWNER_USERNAME`, and load those variables with your process manager. For a local shell, quote the hash so its dollar signs remain literal. Then:

```sh
uv run --env-file .env uvicorn learninglab.app:app --host 127.0.0.1 --port 8000
uv run --env-file .env python -m learninglab.worker
```

The standalone worker also needs the same environment. `docker compose up --build -d` loads `.env` for both services and persists their shared data volume automatically. Open `http://localhost:8000` and sign in. There is no registration endpoint.

In **Your profile → AI connection**, configure an OpenRouter key and a current model identifier privately. Alternatively supply the server environment variables. Without a provider, original lessons, interactive scenes, narrow concept checks, and synthetic experiments still work; the tutor provides a labeled local guide.

## What works today

| Surface | Initial implementation | Important limit |
|---|---|---|
| Learning paths | 40 concepts, chosen prerequisite graph, typed cross-connections, two branch-order policies | A prototype map, not a complete curriculum or established optimal sequence |
| Idea studio | 12 original pilot lessons; interactive ODE, linear-map, derivative, convergence, fraction, probability, and quantifier scenes | Restricted scene templates; no claim of professional film quality or arbitrary scene generation |
| Self-assessment | 11 seeded original concept-check families; separate written proof submissions | Narrow recognition tasks; proof submissions await review; no validated ability score |
| Learner profile | Per-concept evidence, assisted-attempt flags, approximate uncertainty, revisit suggestions | A transparent Beta baseline, not a psychometric instrument |
| Tutor | Bounded current context and optional OpenRouter inference; editable speech dictation and local speech output where supported | Model errors remain possible; speech support and processing depend on the browser |
| Cognitive experiments | Blank initial trace memory, bounded working buffer, reinforcement, decay, paired-seed sequence comparisons | Toy cognitive model; neither an ACT-R implementation nor an uncontaminated LLM learner |
| Background roles | Metadata research, consent-aware evidence analysis, simulations, candidate teaching policies/storyboards | Metadata discovery is not full-paper review; changes require owner review |
| Releases | Content-addressed current snapshots, immutable saved versions, stale-candidate rejection | Release promotion indicates review, not proven pedagogical effectiveness |
| Source register | 28 research/textbook/tool cards with inspected scope, implication, and limits | Initial scoping work, not a systematic or exhaustive literature review |
| Private library bridge | Authenticated source search and reference saving through an optional external pages service | Full texts stay in external storage; no copyrighted corpus is bundled |
| Operations | Single configured owner, revocable sessions, origin and CSRF checks, login throttling, persistent budget reservations, restartable worker | Single-owner deployment; institutional multi-user research requires further work |

## Research and architecture

- [Research agenda and study protocol](docs/research-protocol.md)
- [Initial evidence review and unresolved decisions](docs/literature-review.md)
- [Architecture and integration contract](docs/architecture.md)
- [Development roadmap and acceptance criteria](docs/roadmap.md)
- [Data, privacy, and source rights](docs/data-policy.md)
- [Deployment and recovery](docs/operations.md)
- [Original optional Manim scene](visuals/ode_growth.py)

The core concepts, evidence dimensions, release mechanism, and experiment roles are domain-independent. The first content pack is `learninglab/data/mathematics.json`. Additional domains should bring their own prerequisite models, validators, source trails, and assessments rather than relabeling mathematics exercises.

## Verify and contribute

```sh
uv run ruff check learninglab scripts tests
uv run pytest -q
node --check learninglab/static/app.js
node --check learninglab/static/visuals.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Code is MIT-licensed; original authored educational text and source-card annotations are CC BY 4.0. External works retain their own terms. The project is independent and is not affiliated with referenced authors, institutions, or animation creators.
