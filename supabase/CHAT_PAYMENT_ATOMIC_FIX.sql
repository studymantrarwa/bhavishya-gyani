-- Bhavishya Gyani: atomic chat settlement + user confirmation fields
-- Safe to run repeatedly.
alter table public.conversations add column if not exists chat_started_at timestamptz;
alter table public.conversations add column if not exists chat_budget_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists gross_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists commission_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists net_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_minutes numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
create unique index if not exists uq_earnings_conversation on public.astrologer_earnings(conversation_id) where conversation_id is not null;

create or replace function public.settle_chat_billing(
  p_conversation_id uuid,
  p_user_id uuid,
  p_astrologer_id uuid,
  p_minutes integer,
  p_rate numeric,
  p_commission_percent numeric,
  p_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w wallets%rowtype;
  ua user_accounts%rowtype;
  existing astrologer_earnings%rowtype;
  v_minutes integer := greatest(0, coalesce(p_minutes,0));
  v_rate numeric(12,2) := greatest(0, coalesce(p_rate,0));
  v_comm numeric(7,2) := least(100,greatest(0,coalesce(p_commission_percent,20)));
  v_free integer := 0;
  v_free_used integer := 0;
  v_paid_minutes integer := 0;
  v_paid_amount numeric(12,2) := 0;
  v_gross numeric(12,2) := 0;
  v_commission numeric(12,2) := 0;
  v_net numeric(12,2) := 0;
  v_payment_id uuid;
  v_earning_id uuid;
begin
  if p_conversation_id is null or p_user_id is null or p_astrologer_id is null then
    raise exception 'Invalid chat billing identifiers';
  end if;

  select * into existing from public.astrologer_earnings
    where conversation_id = p_conversation_id limit 1;
  if found then
    return jsonb_build_object('charged',true,'existing',true,'earning_id',existing.id,
      'net',coalesce(existing.net_amount,existing.amount,0),'wallet_amount',coalesce(existing.paid_amount,0),
      'paid_minutes',coalesce(existing.paid_minutes,0));
  end if;

  select * into ua from public.user_accounts where id=p_user_id for update;
  if not found then raise exception 'User account not found'; end if;
  select * into w from public.wallets where user_id=p_user_id for update;
  if not found then
    insert into public.wallets(user_id,balance) values(p_user_id,0) returning * into w;
  end if;

  v_free := greatest(0, coalesce(ua.free_chat_minutes,0));
  v_free_used := least(v_minutes,v_free);
  v_paid_minutes := greatest(0,v_minutes-v_free_used);
  v_paid_amount := round((v_rate*v_paid_minutes)::numeric,2);
  v_gross := v_paid_amount;
  v_commission := round((v_gross*v_comm/100)::numeric,2);
  v_net := greatest(0,round((v_gross-v_commission)::numeric,2));

  if coalesce(w.balance,0) < v_paid_amount then
    raise exception 'INSUFFICIENT_WALLET:%:%',v_paid_amount,coalesce(w.balance,0);
  end if;

  if v_free_used > 0 then
    update public.user_accounts
      set free_chat_minutes=greatest(0,coalesce(free_chat_minutes,0)-v_free_used),
          free_chat_minutes_used=coalesce(free_chat_minutes_used,0)+v_free_used,
          updated_at=now()
      where id=p_user_id;
    begin
      insert into public.chat_free_minute_transactions(user_id,minutes,type,source,conversation_id,description)
      values(p_user_id,v_free_used,'debit','chat',p_conversation_id,
             'Free chat minutes used');
    exception when undefined_table then null; end;
  end if;

  if v_paid_amount > 0 then
    update public.wallets set balance=round((coalesce(balance,0)-v_paid_amount)::numeric,2),updated_at=now() where id=w.id;
    insert into public.payments(user_id,astrologer_id,conversation_id,amount,currency,method,purpose,status,reference)
      values(p_user_id,p_astrologer_id,p_conversation_id,v_paid_amount,'INR','wallet','chat_minutes','approved','CHAT-'||p_conversation_id)
      returning id into v_payment_id;
    insert into public.wallet_transactions(user_id,amount,type,source,payment_id,description)
      values(p_user_id,v_paid_amount,'debit','chat',v_payment_id,
             'Astrologer chat '||v_paid_minutes||' paid minute(s) @ ₹'||v_rate||'/min');
  end if;

  insert into public.astrologer_earnings(astrologer_id,amount,gross_amount,commission_amount,net_amount,paid_amount,paid_minutes,category,conversation_id,earned_at)
    values(p_astrologer_id,v_net,v_gross,v_commission,v_net,v_paid_amount,v_paid_minutes,'chat',p_conversation_id,now())
    returning id into v_earning_id;

  update public.conversations set billed_seconds=greatest(0,coalesce(p_seconds,0)),billed_amount=v_paid_amount where id=p_conversation_id;

  return jsonb_build_object('charged',true,'existing',false,'earning_id',v_earning_id,
    'payment_id',v_payment_id,'minutes',v_minutes,'seconds',greatest(0,coalesce(p_seconds,0)),
    'rate',v_rate,'gross',v_gross,'commission',v_commission,'net',v_net,
    'free_minutes_used',v_free_used,'paid_minutes',v_paid_minutes,'wallet_amount',v_paid_amount);
exception when unique_violation then
  select * into existing from public.astrologer_earnings where conversation_id=p_conversation_id limit 1;
  if found then
    return jsonb_build_object('charged',true,'existing',true,'earning_id',existing.id,
      'net',coalesce(existing.net_amount,existing.amount,0),'wallet_amount',coalesce(existing.paid_amount,0),
      'paid_minutes',coalesce(existing.paid_minutes,0));
  end if;
  raise;
end;
$$;

grant execute on function public.settle_chat_billing(uuid,uuid,uuid,integer,numeric,numeric,integer) to service_role;

-- One-time reconciliation: if a prior chat payment was recorded but its earning row
-- is missing, create the missing net earning without charging the wallet again.
do $$
declare
  r record;
  pct numeric := 20;
  comm numeric;
  net numeric;
begin
  begin
    select coalesce((value->>'commission_percent')::numeric,20) into pct
    from public.platform_settings where key='payment_settings' limit 1;
  exception when others then pct := 20;
  end;
  for r in
    select p.conversation_id,p.astrologer_id,p.amount,p.created_at
    from public.payments p
    left join public.astrologer_earnings e on e.conversation_id=p.conversation_id
    where p.purpose='chat_minutes' and p.status='approved' and p.conversation_id is not null
      and p.astrologer_id is not null and e.id is null
  loop
    comm := round((r.amount*least(100,greatest(0,pct))/100)::numeric,2);
    net := greatest(0,round((r.amount-comm)::numeric,2));
    insert into public.astrologer_earnings(astrologer_id,amount,gross_amount,commission_amount,net_amount,paid_amount,paid_minutes,category,conversation_id,earned_at)
    values(r.astrologer_id,net,r.amount,comm,net,r.amount,0,'chat',r.conversation_id,r.created_at)
    on conflict (conversation_id) do nothing;
  end loop;
end $$;
