-- Cashfree International Payments migration
-- Keeps legacy Razorpay columns for historical records while moving all new
-- payment attempts to Cashfree Hosted Checkout.

alter table public.payment_attempts
  add column if not exists provider text,
  add column if not exists cashfree_order_id text,
  add column if not exists cashfree_cf_order_id text,
  add column if not exists cashfree_payment_session_id text,
  add column if not exists cashfree_payment_id text,
  add column if not exists bank_reference text,
  add column if not exists provider_verified boolean not null default false;

update public.payment_attempts
set provider = case
  when razorpay_order_id is not null or razorpay_payment_id is not null then 'razorpay'
  else 'cashfree'
end
where provider is null;

alter table public.payment_attempts
  alter column provider set default 'cashfree',
  alter column provider set not null;

create unique index if not exists payment_attempts_cashfree_order_id_key
  on public.payment_attempts (cashfree_order_id)
  where cashfree_order_id is not null;

create index if not exists payment_attempts_cashfree_payment_id_idx
  on public.payment_attempts (cashfree_payment_id)
  where cashfree_payment_id is not null;

-- Expand the status machine while preserving legacy statuses so existing data
-- remains valid during the provider transition.
alter table public.payment_attempts
  drop constraint if exists payment_attempts_status_check;

alter table public.payment_attempts
  add constraint payment_attempts_status_check check (
    status in (
      'initializing',
      'created',
      'pending',
      'verification_pending',
      'success',
      'failed',
      'user_dropped',
      'expired',
      'authorized',
      'captured'
    )
  );

-- Only one in-progress checkout session is allowed per payment link. Keep the
-- newest one if old open attempts already exist before creating the index.
with ranked_open_attempts as (
  select
    id,
    row_number() over (partition by link_id order by created_at desc, id desc) as row_number
  from public.payment_attempts
  where status in ('initializing', 'created', 'pending', 'verification_pending')
)
update public.payment_attempts as attempts
set status = 'expired'
from ranked_open_attempts as ranked
where attempts.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists payment_attempts_one_open_session_per_link
  on public.payment_attempts (link_id)
  where status in ('initializing', 'created', 'pending', 'verification_pending');

-- Reject server-side attempt creation when the public payment request is not
-- currently payable. Service-role access does not bypass this invariant.
create or replace function public.ensure_payable_link_for_attempt()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  link_status text;
  link_expires_at timestamptz;
begin
  select status, expires_at
    into link_status, link_expires_at
  from public.payment_links
  where id = new.link_id
  for update;

  if not found then
    raise exception 'Payment link not found';
  end if;

  if link_status <> 'active' then
    raise exception 'Payment link is not active';
  end if;

  if link_expires_at is not null and link_expires_at <= now() then
    raise exception 'Payment link has expired';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_payable_link_before_attempt on public.payment_attempts;
create trigger enforce_payable_link_before_attempt
before insert on public.payment_attempts
for each row execute function public.ensure_payable_link_for_attempt();

alter table public.webhook_events
  alter column provider set default 'cashfree';

alter table public.webhook_events
  drop constraint if exists webhook_events_provider_event_id_key;

create unique index if not exists webhook_events_provider_event_id_key
  on public.webhook_events (provider, event_id);

alter table public.business_settings
  alter column enabled_currencies set default array[
    'SBD','VUV','WST','PGK','INR','USD','AUD','NZD','GBP','EUR','CAD','SGD','AED'
  ];

update public.business_settings
set enabled_currencies = array[
  'SBD','VUV','WST','PGK','INR','USD','AUD','NZD','GBP','EUR','CAD','SGD','AED'
], updated_at = now()
where id = 1;

comment on column public.payment_attempts.cashfree_payment_session_id is
  'Cashfree Hosted Checkout session token. Admin-only; never exposed after checkout creation.';
comment on column public.payment_attempts.provider_verified is
  'True after the server has verified the order with Cashfree API or a signed Cashfree webhook.';
