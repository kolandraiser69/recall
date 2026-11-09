-- ==============================================================================
-- Recall - Supabase Cloud Synchronization Schema
-- Version: 1.0.0
--
-- Note: Recall is an Offline-First application. Supabase is completely optional.
-- This schema establishes cloud persistence with Row-Level Security (RLS)
-- ensuring that each user has strictly isolated access to their own data.
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. DECKS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.decks (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text default '',
    parent_id text null,
    color text null,
    icon text null,
    settings jsonb null,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.decks enable row level security;

create policy "Users can manage their own decks"
    on public.decks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_decks_user_updated on public.decks(user_id, updated_at);

-- ------------------------------------------------------------------------------
-- 2. NOTE TYPES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.note_types (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    kind text not null check (kind in ('standard', 'cloze')),
    fields jsonb not null default '[]'::jsonb,
    templates jsonb not null default '[]'::jsonb,
    css text default '',
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.note_types enable row level security;

create policy "Users can manage their own note types"
    on public.note_types for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_note_types_user_updated on public.note_types(user_id, updated_at);

-- ------------------------------------------------------------------------------
-- 3. NOTES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.notes (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    deck_id text not null,
    note_type_id text not null,
    fields jsonb not null default '{}'::jsonb,
    tags text[] not null default array[]::text[],
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.notes enable row level security;

create policy "Users can manage their own notes"
    on public.notes for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_notes_user_updated on public.notes(user_id, updated_at);
create index if not exists idx_notes_deck_id on public.notes(user_id, deck_id);

-- ------------------------------------------------------------------------------
-- 4. CARDS TABLE (FSRS State)
-- ------------------------------------------------------------------------------
create table if not exists public.cards (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    note_id text not null,
    deck_id text not null,
    template_idx integer not null default 0,
    state integer not null default 0,
    due bigint not null,
    stability double precision not null default 0,
    difficulty double precision not null default 0,
    elapsed_days integer not null default 0,
    scheduled_days integer not null default 0,
    reps integer not null default 0,
    lapses integer not null default 0,
    last_review bigint null,
    is_suspended boolean not null default false,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.cards enable row level security;

create policy "Users can manage their own cards"
    on public.cards for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_cards_user_updated on public.cards(user_id, updated_at);
create index if not exists idx_cards_due on public.cards(user_id, due);

-- ------------------------------------------------------------------------------
-- 5. REVIEWS TABLE (Append-Only Review History)
-- ------------------------------------------------------------------------------
create table if not exists public.reviews (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    card_id text not null,
    rating integer not null,
    state integer not null,
    due bigint not null,
    stability double precision not null,
    difficulty double precision not null,
    elapsed_days integer not null default 0,
    last_elapsed_days integer not null default 0,
    scheduled_days integer not null default 0,
    review bigint not null,
    duration_ms integer not null default 0,
    created_at bigint not null,
    deleted_at bigint null
);

alter table public.reviews enable row level security;

create policy "Users can manage their own review logs"
    on public.reviews for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_reviews_user_created on public.reviews(user_id, created_at);
create index if not exists idx_reviews_card_id on public.reviews(user_id, card_id);

-- ------------------------------------------------------------------------------
-- 6. CALENDAR CATEGORIES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.calendar_categories (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    color text not null,
    icon text null,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.calendar_categories enable row level security;

create policy "Users can manage their own calendar categories"
    on public.calendar_categories for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_calendar_categories_user on public.calendar_categories(user_id, updated_at);

-- ------------------------------------------------------------------------------
-- 7. CALENDAR RECURRING RULES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.calendar_rules (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    frequency text not null default 'weekly',
    interval_val integer not null default 1,
    by_day integer[] not null default array[]::integer[],
    dt_start bigint not null,
    until bigint null,
    count_val integer null,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.calendar_rules enable row level security;

create policy "Users can manage their own recurring rules"
    on public.calendar_rules for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_calendar_rules_user on public.calendar_rules(user_id, updated_at);

-- ------------------------------------------------------------------------------
-- 8. CALENDAR EXCEPTIONS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.calendar_exceptions (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    rule_id text not null,
    original_start bigint not null,
    is_cancelled boolean not null default false,
    override_data jsonb null,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.calendar_exceptions enable row level security;

create policy "Users can manage their own calendar exceptions"
    on public.calendar_exceptions for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_calendar_exceptions_user on public.calendar_exceptions(user_id, updated_at);

-- ------------------------------------------------------------------------------
-- 9. CALENDAR EVENTS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.calendar_events (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text default '',
    start_time bigint not null,
    end_time bigint not null,
    is_all_day boolean not null default false,
    category_id text not null,
    location text default '',
    recurring_rule_id text null,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.calendar_events enable row level security;

create policy "Users can manage their own calendar events"
    on public.calendar_events for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_calendar_events_user_updated on public.calendar_events(user_id, updated_at);
create index if not exists idx_calendar_events_time on public.calendar_events(user_id, start_time, end_time);

-- ------------------------------------------------------------------------------
-- 10. QUICKLINKS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.quicklinks (
    id text primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    url text not null,
    category text not null,
    icon text null,
    is_favorite boolean not null default false,
    sort_order integer not null default 0,
    created_at bigint not null,
    updated_at bigint not null,
    deleted_at bigint null
);

alter table public.quicklinks enable row level security;

create policy "Users can manage their own quicklinks"
    on public.quicklinks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists idx_quicklinks_user_updated on public.quicklinks(user_id, updated_at);
create index if not exists idx_quicklinks_user_order on public.quicklinks(user_id, sort_order);
