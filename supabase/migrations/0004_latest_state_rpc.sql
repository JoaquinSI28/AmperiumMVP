create or replace function public.latest_unit_state()
returns table (unit_id uuid, ts timestamptz, mw_active numeric, is_available boolean)
language sql stable security invoker
as $$
  select distinct on (unit_id) unit_id, ts, mw_active, is_available
  from plant_state
  order by unit_id, ts desc;
$$;
