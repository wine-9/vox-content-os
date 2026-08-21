# VOX Content OS — Architecture

## Purpose

VOX Content OS is a local-first content production and publishing system for VOX 音乐教室. It combines topic discovery, assisted writing, editorial approval, visual packaging, platform adaptation, direct finished-media publishing, archive/history, and a lightweight performance-learning loop.

The production host is a Mac. The web UI is a Next.js application. SQLite is the current primary application store. n8n workflow JSON files exist as optional orchestration blueprints, but the current core publishing paths do not depend on a running n8n instance.

## Runtime topology

```text
Browser
  |
  v
Next.js App Router (:3000)
  |-- app/* UI
  |-- app/api/* API routes
  |
  +--> SQLite (runtime only; never committed)
  +--> Kimi API
  +--> social-auto-upload CLI (Xiaohongshu / Douyin)
  +--> Wechatsync CLI / WeChat official API
  +--> OmniSeek local service
  +--> Google Drive OAuth API (optional archive)
```

Remote human access is intended through a private Tailscale network. Do not expose the publishing console or publisher session material to a public tunnel merely for AI review.

## Main application areas

- `app/topics`: topic discovery and selection.
- `app/editor`: writing, blind candidate selection, Final approval.
- `app/publish`: canonical WeChat visual-master production.
- `app/release`: Xiaohongshu / Douyin adaptation and existing release pipeline.
- `app/release/publish`: platform connection checks and confirmed publishing.
- `app/ingest`: upload an already-finished video and distribute it without editing the media.
- `app/quick-publish`: direct finished-content console for video or image posts. It bypasses topic/writing/master/adaptation and publishes supplied media as-is.
- `app/history`: publish history/archive view.
- `app/growth`: prediction/performance feedback loop.
- `app/learning`: writing preference / learning proposals.

## Canonical editorial publishing path

```text
Research / Topics
  -> Content Item
  -> 3 blind writing candidates
  -> Human choice
  -> Human Final
  -> WeChat visual master
  -> Platform adaptations (XHS / Douyin)
  -> Human approval
  -> Preflight
  -> Publish
  -> Archive / history / performance feedback
```

Important invariant: once the Final/master is approved, platform adaptation is expected to preserve content and assets rather than silently rewrite or shorten the approved article.

## Direct publishing path

Implemented in `lib/direct-publish.ts` and `/api/quick-publish/*`.

```text
Finished video OR finished images
  -> runtime storage under data/quick-publish/
  -> user-supplied title/body/tags
  -> selected platforms
     |-- Xiaohongshu: social-auto-upload
     |-- Douyin: social-auto-upload
     `-- WeChat: draft only
```

The direct path is intentionally separate from editorial generation. It must not modify uploaded finished media. For a video sent to WeChat, current behavior creates a draft using the supplied cover or extracted preview plus the same copy; it does not re-edit the short-video file.

`DRY_RUN_ONLY=true` is the safety default. Production publishing should remain blocked until an operator explicitly changes the runtime environment.

## Database and state

`lib/db.ts` owns most SQLite schema creation and state transitions. `docs/STATE-MACHINE.md` documents the content/release state model. Runtime SQLite files are excluded because they may contain content history, OAuth-related state, operational data, and user-produced material.

High-value audit targets:

1. state-transition correctness and idempotency;
2. duplicate publish prevention and retry behavior;
3. partial failure handling across three platforms;
4. publish history consistency;
5. filesystem/path validation for uploaded/generated assets;
6. authentication/session separation from source code;
7. API-route authorization for remote access;
8. long-running browser-automation request reliability.

## Publishing integrations

Project-owned wrappers:

- `lib/local-social-publish.ts`
- `lib/platform-publish.ts`
- `lib/direct-publish.ts`
- `app/api/release/publish/*`
- `app/api/quick-publish/*`

Third-party source trees are intentionally not vendored into this audit repository. Exact upstream repositories and local revisions are listed in `docs/THIRD-PARTY.md`.

## n8n status

`n8n/topic-engine.json`, `n8n/writing-engine.json`, and `n8n/learning-engine.json` are workflow blueprints. `docker-compose.yml` can start n8n, but the current production Content OS and one-click publishing console do not require n8n to be running. Do not assume these JSON workflows are the canonical runtime orchestrator.

## Secrets and excluded runtime data

Never commit or request these for a source-code audit:

- `.env.local` and `.env.local.*` backups;
- social platform cookies/session files;
- Wechatsync token;
- WeChat AppSecret and OAuth tokens;
- Google Drive OAuth credentials/refresh tokens;
- SQLite databases/WAL/SHM;
- `data/` uploads, exports, publish packages and logs;
- `.ops-backups/`;
- `.venv-sau/`, `.next/`, `node_modules/`;
- local `vendor/` third-party checkouts.

Use `.env.example` only as a key-name reference.

## Audit priority

Prioritize security and correctness before refactoring style. In particular, review whether API routes that trigger login, filesystem writes or real publication need an application-level authentication/authorization boundary in addition to Tailscale network access.
