
-- ============ Roles ============
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid());
create policy "admin read all roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ============ Profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "admin read profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ============ Auto-provision owner + profile ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;

  -- Grant admin ONLY to the owner email, and only if it's the confirmed real address
  if lower(new.email) = 'pratham.work3115@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ Business settings ============
create table public.business_settings (
  id int primary key default 1 check (id = 1),
  brand_name text not null default 'Joshi Web Experts',
  brand_tagline text not null default 'Premium web experiences, engineered by Pratham Joshi.',
  support_email text not null default 'pratham.work3115@gmail.com',
  support_phone text,
  enabled_currencies text[] not null default array['INR','USD','GBP','EUR','AUD','CAD','NZD','SGD','AED'],
  default_tip_presets int[] not null default array[5,10,15],
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "admin manage settings" on public.business_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.business_settings (id) values (1) on conflict do nothing;

-- ============ Payment links ============
create table public.payment_links (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  client_name text not null,
  client_email text,
  client_phone text,
  client_country text,
  project_title text not null,
  description text,
  invoice_ref text,
  base_amount_minor bigint not null check (base_amount_minor > 0),
  currency text not null,
  allow_tip boolean not null default true,
  tip_presets int[] not null default array[5,10,15],
  tip_custom_allowed boolean not null default true,
  tip_min_minor bigint not null default 0,
  tip_max_minor bigint,
  expires_at timestamptz,
  single_use boolean not null default true,
  status text not null default 'active' check (status in ('draft','active','paid','expired','cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_links (status);
create index on public.payment_links (created_at desc);
grant select, insert, update, delete on public.payment_links to authenticated;
grant all on public.payment_links to service_role;
alter table public.payment_links enable row level security;
create policy "admin manage links" on public.payment_links for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ Payment attempts ============
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.payment_links(id) on delete cascade,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  base_amount_minor bigint not null,
  tip_amount_minor bigint not null default 0,
  total_amount_minor bigint not null,
  currency text not null,
  status text not null default 'created' check (status in ('created','authorized','captured','failed','verification_pending')),
  signature_verified boolean not null default false,
  error_code text,
  error_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_attempts (link_id, created_at desc);
grant select on public.payment_attempts to authenticated;
grant all on public.payment_attempts to service_role;
alter table public.payment_attempts enable row level security;
create policy "admin read attempts" on public.payment_attempts for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ============ Webhook events (dedupe) ============
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
create policy "admin read webhooks" on public.webhook_events for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ============ Audit events ============
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_events to authenticated;
grant all on public.audit_events to service_role;
alter table public.audit_events enable row level security;
create policy "admin read audit" on public.audit_events for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ============ updated_at trigger ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end$$;

create trigger t_links_updated before update on public.payment_links
for each row execute function public.touch_updated_at();
create trigger t_attempts_updated before update on public.payment_attempts
for each row execute function public.touch_updated_at();
create trigger t_settings_updated before update on public.business_settings
for each row execute function public.touch_updated_at();
create trigger t_profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();
