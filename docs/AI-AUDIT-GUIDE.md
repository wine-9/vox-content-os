# AI audit guide

## Audit mode

Read the repository first. Do not edit files, run real publishing actions, refresh platform logins, or request production secrets unless explicitly authorized after the audit report.

## Goal

Produce a concrete engineering audit of VOX Content OS. Distinguish current runtime behavior from planned/optional n8n workflows.

## Required review areas

1. Architecture boundaries and duplicated pipelines.
2. Security: API authorization, secrets, Tailscale assumptions, filesystem access, upload validation, command execution, OAuth/cookie handling, SSRF/path traversal risk.
3. Publishing correctness: preflight, idempotency, duplicate posts, retry semantics, partial three-platform failure, timeouts and browser-process failure.
4. State model and SQLite consistency/concurrency.
5. Direct publishing (`app/quick-publish`, `lib/direct-publish.ts`).
6. Canonical editorial publishing (`app/publish`, `app/release`, `lib/local-social-publish.ts`, `lib/platform-publish.ts`).
7. WeChat draft behavior and content invariants.
8. n8n: what is actually used vs stale blueprint code.
9. Maintainability: large files, repeated logic, missing tests, observability and recovery tooling.
10. Supply-chain risks from local third-party CLIs listed in `docs/THIRD-PARTY.md`.

## Output format

Start with an executive summary. Then list findings by severity: Critical, High, Medium, Low. For every finding include the exact file/function/route, failure or attack scenario, impact, reproducible evidence, recommended fix, and whether it is safe to fix immediately.

Finish with a prioritized remediation sequence and a short list of things that are already designed well enough and should not be rewritten without cause.

## Suggested first reads

1. `ARCHITECTURE.md`
2. `README.md`
3. `docs/STATE-MACHINE.md`
4. `lib/db.ts`
5. `lib/local-social-publish.ts`
6. `lib/platform-publish.ts`
7. `lib/direct-publish.ts`
8. `app/api/quick-publish/*`
9. `app/api/release/publish/*`
10. `n8n/*.json`
