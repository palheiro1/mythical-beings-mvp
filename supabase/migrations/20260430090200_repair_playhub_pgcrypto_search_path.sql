-- Compatibility repair for Play Hub RPCs that call gen_random_bytes() with
-- search_path restricted to public. In this Supabase project pgcrypto lives in
-- the extensions schema, so expose the expected public helper without changing
-- the shared playhub_* RPC contracts.

create or replace function public.gen_random_bytes(byte_count integer)
returns bytea
language sql
volatile
as $$
  select extensions.gen_random_bytes(byte_count);
$$;
