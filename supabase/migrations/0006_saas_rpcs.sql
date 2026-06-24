create or replace function public.saas_demand_window(p_minutes int default 120)
returns table (ts timestamptz, demand_mw numeric)
language sql stable security invoker
as $$
  select r.ts, sum(r.power_kw) / 1000.0
  from readings r
  where r.ts > now() - (p_minutes || ' minutes')::interval
  group by r.ts
  order by r.ts;
$$;

create or replace function public.customer_latest_demand()
returns table (customer_id uuid, demand_kw numeric)
language sql stable security invoker
as $$
  with latest_per_meter as (
    select distinct on (m.id) m.customer_id, r.power_kw
    from readings r
    join meters m on m.id = r.meter_id
    where r.ts > now() - interval '60 minutes'
    order by m.id, r.ts desc
  )
  select customer_id, sum(power_kw) from latest_per_meter group by customer_id;
$$;

create or replace function public.my_coop_demand_window(p_minutes int default 60)
returns table (ts timestamptz, demand_mw numeric)
language sql stable security invoker
as $$
  select r.ts, sum(r.power_kw) / 1000.0
  from readings r
  where r.ts > now() - (p_minutes || ' minutes')::interval
  group by r.ts
  order by r.ts;
$$;

create or replace function public.my_coop_top_meters(p_minutes int default 15, p_limit int default 5)
returns table (
  meter_id uuid,
  serial text,
  label text,
  avg_kw numeric,
  capacity_kw numeric
)
language sql stable security invoker
as $$
  select m.id, m.serial, m.label, round(avg(r.power_kw)::numeric, 1), m.capacity_kw
  from meters m
  join readings r on r.meter_id = m.id
  where r.ts > now() - (p_minutes || ' minutes')::interval
  group by m.id
  order by avg(r.power_kw) desc
  limit p_limit;
$$;
