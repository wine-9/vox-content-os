# State machine

## Content / Writing

topic_proposed -> topic_selected -> awaiting_viewpoint
-> generating_candidates
-> blind_review
-> winner_selected / blind_rejected
-> editing
-> final_approved

Blind writing rules:
- 同一个 Content Brief 同时服务 Control / Human Writing / Ultimate Fusion 三个 Writer。
- 三篇全部生成前不展示正文；Kimi 单路失败时保留已完成隐藏稿，下次只补缺失分支。
- 三篇齐全后随机映射 A/B/C；`awaiting_choice` API 不返回 writer_key。
- 用户只回答“哪篇离我愿意继续改并发出去的版本最近”。
- 选择后才 reveal 三个 Writer 身份；只有 Winner 写入 article_versions(candidate)。
- `NONE` 只记录 Writer Preference，不产生 Winner→Final 风格学习样本。

## Learning

blind_choice -> writer_preference_logged

winner_selected -> final_approved -> Winner→Final diff
-> worth_learning / excluded_one_off / fact_correction
-> observation_created -> batch_ready
-> blind_skill_proposal_created
-> proposal_approved -> skill_promoted

两条学习线必须分开：
- Writer Preference 用来训练 Router，不直接生成文风规则。
- Style Learning 只读取 Blind Winner→Final 且人工标记 `worth_learning` 的样本。
- 每 5 篇有效 Blind Winner→Final 样本生成 `blind-worth-N` Proposal。
- 旧单 Candidate 验证样本不进入新学习阈值。
- Active VOX Learned Skill 只叠加到 Ultimate Fusion 分支，Control / Human Writing 保持稳定基线。

## Publish / Visual Master / Platform Adaptation

```text
final_approved
  -> package_ready
  -> wechat_copy_approved
  -> WeChat HTML Base selected
  -> HTML Revision R1 / R2 / ... (optional)
  -> cover Base + Cover Revision(s)
  -> master_approved
  -> platform_adapting
       -> Xiaohongshu adaptation ready -> approved
       -> Douyin adaptation ready      -> approved
  -> ready_to_publish
```

State rules:
- The WeChat package is the canonical visual master; Xiaohongshu/Douyin do not independently establish a new visual direction.
- `master_approved` requires a final selected WeChat HTML plus a ready cover.
- Confirming the master redirects to `/release`.
- Platform adaptation is a real 1080×1440 layout reflow of the confirmed master, not a second content version and not crop/resize/screenshot slicing.
- WeChat/Xiaohongshu share a character-locked manuscript and image-locked content set. No shortening, rewriting, omission, new copy, image replacement or new content image is allowed; overflow creates more pages.
- Initial platform pages are built from immutable blocks parsed directly from the confirmed WeChat HTML; the generator controls pagination/layout only and never receives authority to rewrite copy.
- `ready` is gated by exact full-master visible text equality, the locked image set, shared Minimal Poster artwork, VOX logo, final browser image load checks, and no 1440px overflow.
- Platform tasks run asynchronously and are polled from `/release`; `generating`, `ready`, `approved`, and `failed` are explicit adaptation states.
- Repeated no-op generation of a `ready/approved` adaptation is idempotent.
- Changing the confirmed master invalidates prior platform adaptations and moves the item back to `wechat_copy_approved`.
- Both adaptations must be `approved` before `ready_to_publish`.
- `ready_to_publish != publish_attempted`; with `DRY_RUN_ONLY=true`, the OS must not automatically post to an external platform.

## Learning

Blind writer preference and Winner→Final style learning remain independent of the visual/publish state machine.

### Cover artwork invariant

`Minimal Zine Poster v0.1 Standard Mode -> vertical 3:5 raster poster -> immutable generated-file URL -> 2350×1000 HTML shell (verbatim title + VOX logo) -> asset HTTP validation -> Chrome screenshot -> ready`

The cover renderer must not read a newly generated visual/HTML through `cover_specs` before those DB paths are committed.

## Real publishing layer

`ready_to_publish` means all platform assets are approved. It does **not** mean the content has been published externally.

Flow after asset approval:

`/release` -> `/release/publish`

The real publish console has independent platform actions and persistent `platform_publish_jobs` records.

- WeChat Official Account: official server-side API path is implemented as `upload inline images -> upload permanent cover -> draft/add -> optional freepublish/submit`. `DRY_RUN_ONLY=true` hard-blocks all remote writes.
- Douyin: official OAuth authorization-code flow is implemented for `video.create`. Image upload is officially documented, but the current official `/image_text/create/` documentation exposes no request-body schema, so Content OS does not guess undocumented fields. Until that schema is available/configured, use the export bundle + official creator portal.
- Xiaohongshu: Content OS exports the approved 3:4 bundle and opens the official Creator platform. No undocumented note-publishing API is simulated.
