-- Servicio complementario: SaaS de medición inteligente para cooperativas cliente
create table customers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  location text not null,
  lat double precision not null,
  lng double precision not null,
  cammesa_peak_capacity_mw numeric not null,
  contract_monthly_usd numeric not null default 0,
  contracted_at date,
  created_at timestamptz not null default now()
);

create table meters (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  serial text not null unique,
  label text,
  lat double precision,
  lng double precision,
  capacity_kw numeric not null,
  installed_at date,
  created_at timestamptz not null default now()
);

create index meters_customer_idx on meters(customer_id);

create table readings (
  meter_id uuid not null references meters(id) on delete cascade,
  ts timestamptz not null,
  power_kw numeric not null,
  voltage numeric,
  current numeric,
  primary key (meter_id, ts)
);

create index readings_ts_idx on readings(ts desc);

create table customer_alerts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  meter_id uuid references meters(id) on delete set null,
  type text not null,
  severity alert_severity not null default 'warning',
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index customer_alerts_open_idx on customer_alerts(customer_id, created_at desc) where acknowledged_at is null;

-- Rol nuevo + FK a customer en profiles
alter type user_role add value if not exists 'coop_operator';
alter table profiles add column customer_id uuid references customers(id) on delete set null;

alter table customers       enable row level security;
alter table meters          enable row level security;
alter table readings        enable row level security;
alter table customer_alerts enable row level security;

create or replace function public.auth_customer_id() returns uuid
  language sql stable security definer set search_path = public
as $$
  select customer_id from public.profiles where id = auth.uid()
$$;

create policy "customers_select" on customers for select to authenticated
using (
  public.auth_role() in ('director', 'operator')
  or id = public.auth_customer_id()
);

create policy "meters_select" on meters for select to authenticated
using (
  public.auth_role() in ('director', 'operator')
  or customer_id = public.auth_customer_id()
);

create policy "readings_select" on readings for select to authenticated
using (
  exists (
    select 1 from meters m
    where m.id = readings.meter_id
      and (
        public.auth_role() in ('director', 'operator')
        or m.customer_id = public.auth_customer_id()
      )
  )
);

create policy "customer_alerts_select" on customer_alerts for select to authenticated
using (
  public.auth_role() in ('director', 'operator')
  or customer_id = public.auth_customer_id()
);

alter publication supabase_realtime add table readings;
alter publication supabase_realtime add table customer_alerts;
