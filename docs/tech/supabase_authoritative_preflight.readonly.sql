-- Wisdom Duel authoritative persistence preflight — READ ONLY.
-- Run only on an isolated Supabase branch with an administrative, non-production session.
-- This script contains no DDL or DML and explicitly opens a read-only transaction.
-- Do not publish its output: function definitions and grants are operational metadata.

begin transaction read only;

show server_version;
show transaction_read_only;

select
  current_database() as database_name,
  current_user as inspected_as,
  now() as inspected_at;

-- Installed extensions and versions. The proposal does not pin extension versions.
select e.extname, e.extversion, n.nspname as schema_name
from pg_catalog.pg_extension e
join pg_catalog.pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- Relevant schemas and relations, including legacy Wisdom Duel objects.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  pg_catalog.pg_size_pretty(pg_catalog.pg_total_relation_size(c.oid)) as total_size
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'wisdom_duel_private')
  and (
    c.relname in ('games', 'game_modes', 'game_sessions', 'session_participants', 'session_results')
    or c.relname like 'card_game%'
    or c.relname like 'wisdom_duel%'
  )
order by n.nspname, c.relname;

-- Column contracts, defaults and nullability.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  a.attnum as ordinal_position,
  a.attname as column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
  a.attnotnull as not_null,
  pg_catalog.pg_get_expr(d.adbin, d.adrelid) as default_expression
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attnum > 0
  and not a.attisdropped
  and n.nspname in ('public', 'wisdom_duel_private')
  and (
    c.relname in ('games', 'game_modes', 'game_sessions', 'session_participants', 'session_results')
    or c.relname like 'card_game%'
    or c.relname like 'wisdom_duel%'
  )
order by n.nspname, c.relname, a.attnum;

-- Primary, unique, foreign-key and check constraints.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'wisdom_duel_private')
  and (c.relname like 'card_game%' or c.relname like 'wisdom_duel%')
order by n.nspname, c.relname, con.conname;

-- Index definitions; verify every FK, CAS lookup and RLS player_id is indexed.
select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname in ('public', 'wisdom_duel_private')
  and (tablename like 'card_game%' or tablename like 'wisdom_duel%')
order by schemaname, tablename, indexname;

-- RLS policies, commands and roles.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'wisdom_duel_private')
  and (tablename like 'card_game%' or tablename like 'wisdom_duel%')
order by schemaname, tablename, policyname;

-- Table and sequence grants. Expect no anon write and no authenticated write on projections.
select grantee, table_schema, table_name, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'wisdom_duel_private')
  and (table_name like 'card_game%' or table_name like 'wisdom_duel%')
order by table_schema, table_name, grantee, privilege_type;

select grantee, object_schema, object_name, privilege_type, is_grantable
from information_schema.role_usage_grants
where object_schema in ('public', 'wisdom_duel_private')
  and (object_name like 'card_game%' or object_name like 'wisdom_duel%')
order by object_schema, object_name, grantee, privilege_type;

-- Function signatures, security mode, configuration and definitions.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  pg_catalog.pg_get_userbyid(p.proowner) as owner_name,
  pg_catalog.pg_get_functiondef(p.oid) as definition
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'wisdom_duel_private')
  and (p.proname like 'card_game%' or p.proname like 'wisdom_duel%')
order by n.nspname, p.proname, identity_arguments;

-- Explicit function EXECUTE grants.
select grantee, routine_schema, routine_name, privilege_type, is_grantable
from information_schema.role_routine_grants
where routine_schema in ('public', 'wisdom_duel_private')
  and (routine_name like 'card_game%' or routine_name like 'wisdom_duel%')
order by routine_schema, routine_name, grantee;

-- Realtime publications. Do not modify the realtime schema itself.
select pubname, schemaname, tablename
from pg_catalog.pg_publication_tables
where schemaname in ('public', 'wisdom_duel_private')
  and (tablename like 'card_game%' or tablename like 'wisdom_duel%')
order by pubname, schemaname, tablename;

-- Migration history available to the linked branch.
select version, name, statements
from supabase_migrations.schema_migrations
order by version;

rollback;

