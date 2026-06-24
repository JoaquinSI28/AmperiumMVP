-- Modelo predictivo: naive seasonal forecast.
-- Para cada bucket futuro, predice usando la media de los mismos buckets
-- de las últimas 4 semanas (lag de 7 días). Banda de confianza con stddev.
--
-- Granularidades soportadas:
--   minute  → buckets de 15 min, horizonte típico horas
--   hour    → buckets de 1 hora, horizonte típico días
--   day     → buckets diarios, horizonte típico semanas
--   month   → buckets mensuales (proyección lineal por solo ~1 mes de historia)
--
-- p_customer_id null = portfolio agregado de todas las coops.

create or replace function public.forecast_demand(
  p_customer_id uuid default null,
  p_granularity text default 'hour',
  p_horizon int default 24,
  p_history int default 24
) returns table (
  bucket_ts timestamptz,
  power_mw numeric,
  lower_mw numeric,
  upper_mw numeric,
  is_forecast boolean
)
language plpgsql stable security invoker
as $$
declare
  v_now timestamptz;
  v_step interval;
  v_seasonal_lag interval := interval '7 days';
  v_seasons int := 4;
begin
  v_now := case p_granularity
    when 'minute' then date_trunc('hour', now())
                         + (floor(extract(minute from now()) / 15) * interval '15 minutes')
    when 'hour'   then date_trunc('hour', now())
    when 'day'    then (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires'))
                         at time zone 'America/Argentina/Buenos_Aires'
    when 'month'  then (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires'))
                         at time zone 'America/Argentina/Buenos_Aires'
    else date_trunc('hour', now())
  end;

  v_step := case p_granularity
    when 'minute' then interval '15 minutes'
    when 'hour'   then interval '1 hour'
    when 'day'    then interval '1 day'
    when 'month'  then interval '1 month'
    else interval '1 hour'
  end;

  return query
  with
  per_ts as (
    select r.ts, sum(r.power_kw) / 1000.0 as ts_mw
    from readings r
    join meters m on m.id = r.meter_id
    where (p_customer_id is null or m.customer_id = p_customer_id)
      and r.ts > now() - interval '32 days'
    group by r.ts
  ),
  bucketed as (
    select
      case p_granularity
        when 'minute' then date_trunc('hour', ts)
                            + (floor(extract(minute from ts) / 15) * interval '15 minutes')
        when 'hour'   then date_trunc('hour', ts)
        when 'day'    then (date_trunc('day', ts at time zone 'America/Argentina/Buenos_Aires'))
                              at time zone 'America/Argentina/Buenos_Aires'
        when 'month'  then (date_trunc('month', ts at time zone 'America/Argentina/Buenos_Aires'))
                              at time zone 'America/Argentina/Buenos_Aires'
      end as b_ts,
      avg(ts_mw) as b_mw
    from per_ts
    group by 1
  ),
  history_rows as (
    select b_ts as h_ts, round(b_mw::numeric, 3) as h_mw
    from bucketed
    where b_ts > v_now - (p_history * v_step) and b_ts <= v_now
  ),
  future_ts as (
    select v_now + (gs * v_step) as f_ts
    from generate_series(1, p_horizon) as gs
  ),
  forecast_rows as (
    select
      f.f_ts,
      round(avg(b.b_mw)::numeric, 3) as f_mw,
      round(greatest(0, avg(b.b_mw) - 1.5 * coalesce(stddev_samp(b.b_mw), avg(b.b_mw) * 0.05))::numeric, 3) as f_lower,
      round((avg(b.b_mw) + 1.5 * coalesce(stddev_samp(b.b_mw), avg(b.b_mw) * 0.05))::numeric, 3) as f_upper
    from future_ts f
    cross join generate_series(1, case when p_granularity = 'month' then 1 else v_seasons end) as season
    left join bucketed b
      on b.b_ts = case p_granularity
        when 'month' then f.f_ts - interval '1 month'
        else f.f_ts - (season * v_seasonal_lag)
      end
    where b.b_mw is not null
    group by f.f_ts
  )
  select h_ts, h_mw, h_mw, h_mw, false from history_rows
  union all
  select f_ts, f_mw, f_lower, f_upper, true from forecast_rows
  order by 1;
end;
$$;
