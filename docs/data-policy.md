# Data and source policy

Status: current baseline, 2026-11-23.

The public repository contains code, original lessons, source metadata, original annotations, schemas, and synthetic tests. It contains no source PDFs, private textbooks, learner transcripts, access tokens, deployment identities, or private library exports.

Full books, papers, extraction results, reading notes, and restricted materials belong in an authorized external library. Preserve the original source URL, DOI/arXiv version/ISBN edition, retrieval date, checksum, license or access basis, and review depth. Free-to-read does not mean freely redistributable. Do not bypass paywalls or include instructor-only solutions.

The initial deployment has one externally configured owner. Passwords are scrypt-hashed; session tokens are random and only their hashes are stored. No public enrollment endpoint exists. A configured OpenRouter key is saved with mode 0600 in the data volume or supplied by the process environment; APIs never return it. The server and provider receive the mathematical content sent for inference. Browser dictation may involve a browser vendor's speech service; the UI requests explicit user action and allows transcript review before sending.

Learner records remain in the runtime store. Conversation retention and research observation retention are separate opt-in preferences. The tutor does not read the conversation archive. Descriptive research analysis does not use profile observations unless research consent is enabled. Research consent does not authorize public publication of identifiable records.

The owner can export their profile and retained events, or delete learning evidence, attempts, proofs, and conversation records. Operational budgets, approved teaching snapshots, separately stored library sources, and independent backups have separate lifecycles. Operators must define backup retention and perform restore tests. Institutional research and multi-user deployment require additional consent, access controls, audit, and retention design.
