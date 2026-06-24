-- Helpers
create or replace function public.auth_role() returns user_role
  language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_director() returns boolean
  language sql stable security definer set search_path = public
as $$
  select coalesce(role = 'director', false) from public.profiles where id = auth.uid()
$$;

-- RLS
alter table profiles enable row level security;
alter table plant_state enable row level security;
alter table equipment enable row level security;
alter table technical_alerts enable row level security;
alter table daily_summary enable row level security;

create policy "profile_select" on profiles for select to authenticated
using (id = auth.uid() or public.is_director());

create policy "plant_select"     on plant_state       for select to authenticated using (true);
create policy "equipment_select" on equipment         for select to authenticated using (true);
create policy "alerts_select"    on technical_alerts  for select to authenticated using (true);
create policy "summary_select"   on daily_summary     for select to authenticated using (public.is_director());

create policy "alerts_update" on technical_alerts for update to authenticated
  using (true) with check (true);

-- Helper para crear usuarios demo
create or replace function public.create_demo_user(p_email text, p_password text)
returns uuid language plpgsql security definer as $$
declare
  v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_uid, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, false, '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_uid, v_uid::text,
    jsonb_build_object('sub', v_uid::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
  return v_uid;
end;
$$;

-- Curva de despacho ~ similar al perfil de demanda nacional argentina
create or replace function public.dispatch_factor(t timestamptz)
returns numeric language plpgsql immutable as $$
declare
  hour_local numeric;
  dow int;
  m numeric;
  e numeric;
  base numeric := 0.55;
  wk numeric;
begin
  hour_local := extract(hour from t at time zone 'America/Argentina/Buenos_Aires')
              + extract(minute from t at time zone 'America/Argentina/Buenos_Aires') / 60.0;
  dow := extract(dow from t at time zone 'America/Argentina/Buenos_Aires');
  m := 0.30 * exp(-power((hour_local - 9.0) / 2.2, 2));
  e := 0.40 * exp(-power((hour_local - 20.0) / 2.5, 2));
  wk := case when dow in (0, 6) then 0.93 else 1.0 end;
  return greatest(0.35, least(1.0, (base + m + e) * wk));
end;
$$;

-- Realtime
alter publication supabase_realtime add table plant_state;
alter publication supabase_realtime add table technical_alerts;
