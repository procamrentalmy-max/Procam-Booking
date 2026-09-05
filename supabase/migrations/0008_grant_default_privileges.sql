-- Critical fix: no table in this project had any GRANT for
-- anon/authenticated/service_role — confirmed via
-- has_table_privilege(...) returning false for every single table. The
-- whole application was non-functional against the real REST API this
-- entire time; every earlier verification this session was either
-- code-level (tsc/vitest) or via MCP's own privileged Postgres
-- connection, which bypasses grants entirely — so this was never caught
-- until the first real browser request hit the live project.
--
-- Root cause: this schema was created as one large raw-SQL batch rather
-- than incrementally through the dashboard, with "Automatically expose
-- new tables" disabled in Data API settings (a deliberate earlier
-- choice, reasoned as a safety net for forgotten RLS). That setting
-- controls exactly these grants — disabling it before a from-scratch
-- schema apply meant nothing ever got them. RLS was never the problem
-- (every table has it enabled with real policies); this is the
-- prerequisite privilege check that runs before RLS is even evaluated.
--
-- Mirrors Supabase's own standard default grants for the public schema.
-- Safe: RLS is what actually restricts what each role can see/touch;
-- these grants are just "can this role touch this table at all."

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant all on all sequences in schema public to postgres, service_role;
grant all on all functions in schema public to postgres, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, anon;

alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated, anon;
