-- Pins search_path on functions the Supabase security advisor flagged as
-- "search path mutable" — without this, a function's unqualified table/
-- sequence references resolve using the CALLER's search_path, which a
-- malicious caller could manipulate (e.g. a schema shadowing `partners`)
-- to redirect what the function actually reads/writes. 0001_init.sql is
-- kept as the from-scratch reference for local `supabase db reset`; this
-- migration is what's actually applied on top of the already-deployed
-- project going forward.

create or replace function next_human_id(seq_name text, prefix text, pad int)
returns text
language plpgsql
set search_path = public
as $$
declare
  n bigint;
begin
  execute format('select nextval(%L)', seq_name) into n;
  return prefix || '-' || lpad(n::text, pad, '0');
end;
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function set_rental_asset_human_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix text;
begin
  if new.human_id is not null then
    return new;
  end if;
  select asset_prefix into v_prefix from rental_products where id = new.product_id;
  new.human_id := v_prefix || '-' || lpad(nextval('rental_assets_human_id_seq')::text, 3, '0');
  return new;
end;
$$;
