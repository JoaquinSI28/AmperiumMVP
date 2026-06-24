-- Multi-unidad: AMPERIUM opera 3 plantas distribuidas en provincia de Buenos Aires
create table generation_units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  location text not null,
  lat double precision not null,
  lng double precision not null,
  capacity_mw numeric not null,
  commissioned_at date,
  status text not null default 'operational',
  created_at timestamptz not null default now()
);

alter table generation_units enable row level security;
create policy "units_select" on generation_units for select to authenticated using (true);

-- Agregar unit_id a tablas existentes
alter table plant_state      add column unit_id uuid references generation_units(id) on delete cascade;
alter table equipment        add column unit_id uuid references generation_units(id) on delete cascade;
alter table technical_alerts add column unit_id uuid references generation_units(id) on delete cascade;
alter table daily_summary    add column unit_id uuid references generation_units(id) on delete cascade;

-- Backfill: lo existente pertenece a la planta inicial Tandil Sur
-- (Asumimos que la primera unit_id en generation_units es Tandil Sur — el seed lo asegura)
update plant_state ps      set unit_id = (select id from generation_units where slug = 'tandil-sur') where unit_id is null;
update equipment e         set unit_id = (select id from generation_units where slug = 'tandil-sur') where unit_id is null;
update technical_alerts ta set unit_id = (select id from generation_units where slug = 'tandil-sur') where unit_id is null;
update daily_summary ds    set unit_id = (select id from generation_units where slug = 'tandil-sur') where unit_id is null;

alter table plant_state      alter column unit_id set not null;
alter table equipment        alter column unit_id set not null;
alter table technical_alerts alter column unit_id set not null;
alter table daily_summary    alter column unit_id set not null;

-- PKs compuestas
alter table plant_state   drop constraint plant_state_pkey;
alter table plant_state   add primary key (unit_id, ts);

alter table daily_summary drop constraint daily_summary_pkey;
alter table daily_summary add primary key (unit_id, date);
