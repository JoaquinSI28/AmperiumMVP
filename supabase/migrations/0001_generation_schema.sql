-- AMPERIUM · schema centrado en operación de central térmica
create type user_role as enum ('operator', 'director');
create type equipment_type as enum (
  'gas_turbine', 'generator', 'transformer', 'gas_system', 'cooling_system', 'control_room'
);
create type equipment_status as enum ('operational', 'warning', 'maintenance', 'offline');
create type alert_severity as enum ('info', 'warning', 'critical');

-- Perfiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Estado de planta (telemetría time-series)
create table plant_state (
  ts timestamptz primary key,
  mw_active numeric not null,
  mw_reactive numeric not null,
  freq_hz numeric not null,
  voltage_kv numeric not null,
  gas_m3h numeric not null,
  eff_pct numeric not null,
  turbine_temp_c numeric not null,
  vibration_mms numeric not null,
  fuel_stock_m3 numeric not null,
  is_available boolean not null default true,
  setpoint_mw numeric
);

create index plant_state_ts_idx on plant_state(ts desc);

-- Equipos críticos
create table equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type equipment_type not null,
  hours_operated numeric not null default 0,
  last_inspection date,
  next_inspection date,
  status equipment_status not null default 'operational',
  notes text,
  created_at timestamptz not null default now()
);

-- Alarmas técnicas
create table technical_alerts (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipment(id) on delete set null,
  type text not null,
  severity alert_severity not null default 'warning',
  message text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index alerts_open_idx on technical_alerts(created_at desc) where acknowledged_at is null;

-- Resumen diario precomputado
create table daily_summary (
  date date primary key,
  mwh_generated numeric not null,
  revenue_ars numeric not null,
  spot_price_avg_usd_mwh numeric not null,
  availability_pct numeric not null,
  avg_eff_pct numeric not null,
  peak_mw numeric not null,
  hours_online numeric not null,
  gas_consumed_m3 numeric not null
);
