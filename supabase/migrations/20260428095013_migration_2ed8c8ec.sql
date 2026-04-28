alter table app_settings
  add column if not exists enabled_locales text[] not null default '{en,ar,es,fr,de,pt,hi,zh,ja,ru}';