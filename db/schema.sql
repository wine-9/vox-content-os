create extension if not exists pgcrypto;

create table if not exists topics (
  id uuid primary key default gen_random_uuid(), title text not null, column_key text not null,
  why_now text, vox_angle text, source_summary text, source_url text,
  freshness_score numeric, vox_fit_score numeric, audible_score numeric, suggested_format text,
  status text not null default 'proposed' check (status in ('proposed','saved','selected')),
  created_at timestamptz not null default now()
);
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(), topic_id uuid not null references topics(id),
  content_state text not null default 'awaiting_viewpoint', publish_state text not null default 'dry_run',
  user_raw_input text, final_text text, source_kind text not null default 'topic', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists skill_proposals (
  id uuid primary key default gen_random_uuid(), batch_key text not null, proposal_json jsonb not null,
  status text not null default 'pending', review_note text, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table if not exists skill_versions (
  id uuid primary key default gen_random_uuid(), version text not null unique, body text not null, changelog text,
  status text not null default 'draft', source_proposal_id uuid references skill_proposals(id), created_at timestamptz not null default now()
);
create table if not exists candidate_sets (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  brief_text text not null, status text not null default 'generating', blind_order_json jsonb not null default '[]'::jsonb,
  winner_variant_id uuid, created_at timestamptz not null default now(), chosen_at timestamptz
);
create table if not exists candidate_variants (
  id uuid primary key default gen_random_uuid(), set_id uuid not null references candidate_sets(id) on delete cascade,
  writer_key text not null check (writer_key in ('control','human_writing','ultimate_fusion')), body text not null,
  model_name text, skill_version_id uuid references skill_versions(id), created_at timestamptz not null default now(), unique(set_id,writer_key)
);
create table if not exists article_versions (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  version_type text not null, body text not null, model_name text, skill_version_id uuid references skill_versions(id),
  writer_key text, candidate_set_id uuid references candidate_sets(id), created_at timestamptz not null default now()
);
create table if not exists writer_preferences (
  id uuid primary key default gen_random_uuid(), set_id uuid not null unique references candidate_sets(id) on delete cascade,
  content_item_id uuid not null references content_items(id) on delete cascade, winner_variant_id uuid references candidate_variants(id),
  choice_label text not null, created_at timestamptz not null default now()
);
create table if not exists learning_labels (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  label text not null, created_at timestamptz not null default now(), unique(content_item_id,label)
);
create table if not exists diff_observations (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  category text not null, before_text text, after_text text, explanation text, confidence numeric, created_at timestamptz not null default now()
);
create table if not exists publish_packages (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  platform text not null check (platform in ('xiaohongshu','douyin','wechat_long_image')), title text not null, body text not null,
  visual_prompt text, status text not null default 'package_ready', render_status text not null default 'not_started', model_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(content_item_id,platform)
);
create table if not exists rendered_assets (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references publish_packages(id) on delete cascade,
  kind text not null, file_path text not null, width integer, height integer, model_name text, created_at timestamptz not null default now()
);
create table if not exists html_visual_variants (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references publish_packages(id) on delete cascade,
  theme_key text not null, label text not null, base_file_path text not null, status text not null default 'generated',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), selected_at timestamptz, unique(package_id,theme_key)
);
create table if not exists html_visual_generation_jobs (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references publish_packages(id) on delete cascade,
  theme_key text not null, label text not null, output_file_path text not null,
  status text not null default 'generating', error_text text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(package_id,theme_key)
);
create table if not exists html_visual_revisions (
  id uuid primary key default gen_random_uuid(), variant_id uuid not null references html_visual_variants(id) on delete cascade,
  revision_no integer not null, file_path text not null, edit_instruction text not null, is_final boolean not null default false,
  created_at timestamptz not null default now(), unique(variant_id,revision_no)
);
create table if not exists cover_specs (
  package_id uuid primary key references publish_packages(id) on delete cascade,
  skill_key text not null default 'gc-minimal-zine-poster-v0-1', status text not null default 'not_started', font_mode text not null default 'serif',
  logo_asset_path text, notes text, generation_id uuid, visual_asset_path text, cover_html_path text, cover_png_path text,
  model_name text, prompt_text text, error_text text, updated_at timestamptz not null default now()
);
create table if not exists cover_revisions (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references publish_packages(id) on delete cascade,
  revision_no integer not null, edit_instruction text not null, visual_asset_path text not null,
  cover_html_path text not null, cover_png_path text not null, prompt_text text, model_name text,
  created_at timestamptz not null default now(), unique(package_id,revision_no)
);
create table if not exists platform_adaptations (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  source_package_id uuid not null references publish_packages(id) on delete cascade,
  platform text not null check (platform in ('xiaohongshu','douyin')), status text not null default 'not_started',
  current_revision_no integer not null default 0, files_json jsonb, model_name text, last_instruction text, error_text text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(content_item_id,platform)
);
create table if not exists platform_adaptation_revisions (
  id uuid primary key default gen_random_uuid(), adaptation_id uuid not null references platform_adaptations(id) on delete cascade,
  revision_no integer not null, files_json jsonb not null, edit_instruction text, model_name text,
  created_at timestamptz not null default now(), unique(adaptation_id,revision_no)
);

-- Per-content pre-writing calibration. These records deliberately keep source
-- messages and correction-friendly observations local to one article; they are
-- not a creator personality profile or a cross-content learning model.
create table if not exists creator_calibrations (
  content_item_id uuid primary key references content_items(id) on delete cascade,
  mode text not null default 'undecided' check (mode in ('undecided','chat','direct')),
  status text not null default 'not_started', direct_text text, brief_json jsonb,
  last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists creator_calibration_messages (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  role text not null check (role in ('user','assistant')), body text not null, stage text, metadata_json jsonb,
  created_at timestamptz not null default now()
);
create table if not exists creator_calibration_observations (
  id uuid primary key default gen_random_uuid(), content_item_id uuid not null references content_items(id) on delete cascade,
  kind text not null, value text not null, source_message_id uuid references creator_calibration_messages(id) on delete set null,
  confidence numeric not null default .5, status text not null default 'candidate', correction_text text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS platform_publish_jobs(id TEXT PRIMARY KEY,content_item_id TEXT NOT NULL,platform TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'not_started',remote_id TEXT,error_text TEXT,meta_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(content_item_id) REFERENCES content_items(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS platform_oauth_tokens(platform TEXT PRIMARY KEY,access_token TEXT NOT NULL,refresh_token TEXT,open_id TEXT,scope TEXT,expires_at INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS platform_oauth_states(state TEXT PRIMARY KEY,platform TEXT NOT NULL,content_item_id TEXT,expires_at INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
