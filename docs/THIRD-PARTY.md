# Third-party runtime dependencies

These projects are checked out locally under `vendor/` on the production Mac. Their source trees and runtime auth artifacts are not copied into this repository.

| Component | Upstream | Local revision | Use |
| --- | --- | --- | --- |
| Wechatsync | https://github.com/wechatsync/Wechatsync.git | `a98e428` | WeChat publishing bridge / draft workflow |
| guizang-social-card-skill | https://github.com/op7418/guizang-social-card-skill.git | `cf4b810` | social-card visual method/reference |
| OmniSeek | https://github.com/Battam1111/omniseek.git | `d141f06` | research/search source |
| social-auto-upload | https://github.com/dreammis/social-auto-upload.git | `008e4ff` | Xiaohongshu / Douyin browser publishing CLI |

For security review, audit the project-owned wrappers first. If supply-chain or browser-automation behavior is in scope, fetch and inspect the pinned upstream revisions separately.
