-- ============================================================================
-- ULTIMATE (ultimate-wear.com) — Complete Supabase Schema, RLS & Storage Setup
-- Palette: Deep Black (#09090B) / Crisp White (#FFFFFF) / Luxury Gold (#D4AF37)
-- Paste and execute this entire script inside the Supabase SQL Editor.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_ar text not null,
  description_en text not null,
  description_ar text not null,
  category text not null default 'heavyweight'
    check (length(trim(category)) >= 2),
  price_egp integer not null check (price_egp > 0),
  compare_at_price_egp integer check (compare_at_price_egp is null or compare_at_price_egp >= price_egp),
  sizes text[] not null default array['S', 'M', 'L', 'XL']::text[],
  image_url text not null,
  colors jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migrations for existing installations
alter table public.profiles add column if not exists governorate text;
alter table public.products add column if not exists colors jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists size_stock jsonb not null default '{}'::jsonb;
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check check (length(trim(category)) >= 2);

create table if not exists public.store_sections (
  slug text primary key,
  label_en text not null,
  label_ar text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  show_in_hero boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  hero_badge_en text not null default 'DROP 01',
  hero_badge_ar text not null default 'DROP 01',
  hero_headline_en text not null default 'WORN BY THE FEW.',
  hero_headline_ar text not null default 'للقِلّة فقط.',
  hero_subheadline_en text not null default 'Heavyweight presence. Zero noise.',
  hero_subheadline_ar text not null default 'حضور ثقيل. تفاصيل تتكلم بصمت.',
  featured_title_en text not null default 'FEATURED DROP',
  featured_title_ar text not null default 'المجموعة',
  shop_eyebrow_en text not null default 'THE COLLECTION',
  shop_eyebrow_ar text not null default 'المجموعة المختارة',
  shop_title_en text not null default 'Curated Heavyweight Hoodies',
  shop_title_ar text not null default 'هوديز ثقيلة فاخرة',
  shop_subtitle_en text not null default 'Small-batch Egyptian cotton fleece designed for structured drape and enduring luxury.',
  shop_subtitle_ar text not null default 'إنتاج بكميات محدودة من أجود الأقطان المصرية لقصة متماسكة وفخامة تدوم.',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  customer_email text not null,
  customer_phone text not null,
  shipping_address text not null,
  city text not null,
  payment_method text not null check (payment_method in ('vodafone_cash', 'instapay')),
  payment_mode text not null default 'full_transfer' check (payment_mode in ('full_transfer', 'full_cod')),
  paid_amount integer not null default 0 check (paid_amount >= 0),
  remaining_cod_amount integer not null default 0 check (remaining_cod_amount >= 0),
  governorate text,
  sender_phone text,
  transaction_ref text,
  receipt_path text,
  total_amount integer not null check (total_amount > 0),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  notes text,
  telegram_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_title_en text not null,
  product_title_ar text not null,
  size text not null check (size in ('S', 'M', 'L', 'XL', 'XXL', '3XL')),
  color_name text,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price > 0)
);

alter table public.order_items add column if not exists color_name text;
alter table public.order_items drop constraint if exists order_items_size_check;
alter table public.order_items add constraint order_items_size_check
  check (size in ('S', 'M', 'L', 'XL', 'XXL', '3XL'));

alter table public.orders add column if not exists governorate text;
alter table public.orders add column if not exists payment_mode text not null default 'full_transfer';
alter table public.orders add column if not exists paid_amount integer not null default 0;
alter table public.orders add column if not exists remaining_cod_amount integer not null default 0;
alter table public.orders alter column receipt_path drop not null;
update public.orders
  set payment_mode = 'full_transfer'
  where payment_mode is null or payment_mode not in ('full_transfer', 'full_cod');
alter table public.orders drop constraint if exists orders_payment_mode_check;
alter table public.orders add constraint orders_payment_mode_check
  check (payment_mode in ('full_transfer', 'full_cod'));
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending_verification', 'confirmed', 'shipped', 'delivered', 'cancelled'));

-- Indexes for fast storefront, order history, and admin queries
create index if not exists idx_products_featured_stock on public.products (is_featured, in_stock, created_at desc);
create index if not exists idx_orders_user_created on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    (
      coalesce((auth.jwt()->>'email_verified')::boolean, false)
      and lower(coalesce(auth.jwt()->>'email', '')) = 'okhatab055@gmail.com'
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_admin = true
    )
  );
$$;

-- Automatically create a profile row (with name & phone from registration / OAuth metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := coalesce(new.email, '');
  v_full_name text := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), '');
  v_phone text := nullif(trim(coalesce(new.raw_user_meta_data->>'phone', '')), '');
  v_is_owner boolean := lower(v_email) = 'okhatab055@gmail.com';
begin
  insert into public.profiles (id, email, full_name, phone, is_admin)
  values (new.id, v_email, v_full_name, v_phone, v_is_owner)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        phone = coalesce(public.profiles.phone, excluded.phone),
        is_admin = case when v_is_owner then true else public.profiles.is_admin end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zero-Trust column protection: non-admin users can NEVER self-promote is_admin
create or replace function public.protect_is_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    -- Allow SQL editor / postgres superuser (auth.uid() is null) or existing admin
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Unauthorized attempt to modify is_admin privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_admin on public.profiles;
create trigger trg_protect_is_admin
  before update on public.profiles
  for each row execute function public.protect_is_admin_column();

-- Idempotent RPC so order owner can mark Telegram alert dispatched once
create or replace function public.mark_order_telegram_notified(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.orders
  set telegram_notified = true
  where id = p_order_id
    and user_id = auth.uid()
    and telegram_notified = false;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

-- Self-service SECURITY DEFINER profile sync so onboarding never fails on table GRANT drift
create or replace function public.upsert_own_profile(
  p_full_name text default null,
  p_phone text default null,
  p_governorate text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := coalesce(auth.jwt()->>'email', '');
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_gov text := nullif(trim(coalesce(p_governorate, '')), '');
  v_is_owner boolean := lower(v_email) = 'okhatab055@gmail.com';
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  if v_email = '' then
    select coalesce(email, '') into v_email from auth.users where id = v_uid;
  end if;

  insert into public.profiles (id, email, full_name, phone, governorate, is_admin)
  values (v_uid, v_email, v_name, v_phone, v_gov, v_is_owner)
  on conflict (id) do update
    set email = coalesce(nullif(excluded.email, ''), public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone),
        governorate = coalesce(excluded.governorate, public.profiles.governorate);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & EXPLICIT TABLE/FUNCTION GRANTS
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on public.profiles to postgres, service_role;
grant all privileges on public.orders to postgres, service_role;
grant all privileges on public.order_items to postgres, service_role;
grant all privileges on public.products to postgres, service_role;
grant all privileges on public.store_sections to postgres, service_role;
grant all privileges on public.store_settings to postgres, service_role;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

grant select on public.store_sections to anon, authenticated;
grant insert, update, delete on public.store_sections to authenticated;

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, delete on public.order_items to authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.mark_order_telegram_notified(uuid) to authenticated;
revoke all on function public.upsert_own_profile(text, text, text) from public;
grant execute on function public.upsert_own_profile(text, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_sections enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- PROFILES
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id and is_admin = false);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- PRODUCTS
drop policy if exists "products_public_select" on public.products;
create policy "products_public_select"
  on public.products for select
  using (true);

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
  on public.products for insert
  with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
  on public.products for delete
  using (public.is_admin());

-- STORE SECTIONS & SETTINGS (Public read, Admin write)
drop policy if exists "store_sections_public_select" on public.store_sections;
create policy "store_sections_public_select"
  on public.store_sections for select
  using (true);

drop policy if exists "store_sections_admin_insert" on public.store_sections;
create policy "store_sections_admin_insert"
  on public.store_sections for insert
  with check (public.is_admin());

drop policy if exists "store_sections_admin_update" on public.store_sections;
create policy "store_sections_admin_update"
  on public.store_sections for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "store_sections_admin_delete" on public.store_sections;
create policy "store_sections_admin_delete"
  on public.store_sections for delete
  using (public.is_admin());

drop policy if exists "store_settings_public_select" on public.store_settings;
create policy "store_settings_public_select"
  on public.store_settings for select
  using (true);

drop policy if exists "store_settings_admin_insert" on public.store_settings;
create policy "store_settings_admin_insert"
  on public.store_settings for insert
  with check (public.is_admin());

drop policy if exists "store_settings_admin_update" on public.store_settings;
create policy "store_settings_admin_update"
  on public.store_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ORDERS
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (
    auth.uid() = user_id
    and status = 'pending_verification'
    and (
      payment_mode = 'full_cod'
      or receipt_path like (auth.uid()::text || '/%')
    )
  );

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete"
  on public.orders for delete
  using (public.is_admin());

-- ORDER ITEMS
drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "order_items_insert_own" on public.order_items;
create policy "order_items_insert_own"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. STORAGE BUCKETS & POLICIES
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage policies: product-images
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- Storage policies: payment-receipts (private, per-user folder isolation)
drop policy if exists "payment_receipts_owner_or_admin_read" on storage.objects;
create policy "payment_receipts_owner_or_admin_read"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "payment_receipts_authenticated_insert_own" on storage.objects;
create policy "payment_receipts_authenticated_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-receipts'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "payment_receipts_admin_delete" on storage.objects;
create policy "payment_receipts_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'payment-receipts' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. SEED LUXURY ULTIMATE HOODIES
-- ----------------------------------------------------------------------------

insert into public.products (
  slug,
  title_en,
  title_ar,
  description_en,
  description_ar,
  category,
  price_egp,
  compare_at_price_egp,
  sizes,
  image_url,
  is_featured,
  in_stock
)
values
  (
    'obsidian-crest-hoodie',
    'Obsidian Crest 520GSM Hoodie',
    'هودي أوبسيديان كريست 520GSM',
    'Engineered from brushed 520GSM Egyptian French terry in deep obsidian black with precision gold crest embroidery and dropped shoulders.',
    'مصنوع من قطن مصري فاخر بوزن 520 جرام باللون الأسود الداكن مع تطريز ذهبي دقيق وقصة أكتاف ساقطة فخمة.',
    'heavyweight',
    1850,
    2200,
    array['S', 'M', 'L', 'XL'],
    '/images/hoodies/obsidian-crest.jpg',
    true,
    true
  ),
  (
    'ivory-atelier-hoodie',
    'Ivory Atelier Edition Hoodie',
    'هودي أتيليه آيفوري إديشن',
    'Architectural crisp ivory silhouette cut in heavyweight double-knit cotton with minimalist tonal seams and gold metal aglets.',
    'تصميم معماري باللون الأبيض الناصع من القطن المزدوج الثقيل مع خياطة متناسقة وأطراف رباط معدنية ذهبية.',
    'oversized',
    1950,
    null,
    array['S', 'M', 'L', 'XL'],
    '/images/hoodies/ivory-atelier.jpg',
    true,
    true
  ),
  (
    'gold-monolith-hoodie',
    'Gold Monolith Drop Hoodie',
    'هودي جولد مونوليث إصدار خاص',
    'Limited-run black monolith fleece featuring metallic gold back typography, double-layered structured hood, and ribbed cuffs.',
    'إصدار محدود باللون الأسود الفاخر مع طباعة ذهبية معدنية بارزة وقبعة مزدوجة الطبقات وأساور متينة.',
    'heavyweight',
    2150,
    2500,
    array['M', 'L', 'XL'],
    '/images/hoodies/gold-monolith.jpg',
    true,
    true
  ),
  (
    'eclipse-heavyweight-hoodie',
    'Eclipse Boxy Street Hoodie',
    'هودي إكليبس بوكسي ستريت',
    'Cropped boxy streetwear proportions in matte black 500GSM fleece with gold-piped kangaroo pocket and reinforced collar.',
    'قصة بوكسي عصرية من الصوف القطني 500 جرام بلون أسود مطفي مع جيب أمامي مطرز بحواف ذهبية.',
    'oversized',
    1750,
    null,
    array['S', 'M', 'L', 'XL'],
    '/images/hoodies/eclipse-heavyweight.jpg',
    true,
    true
  ),
  (
    'sovereign-zip-hoodie',
    'Sovereign Gold-Zip Hoodie',
    'هودي سوفرين بسحاب ذهبي',
    'Full two-way luxury gold hardware zipper hoodie crafted from dense black interlock cotton for clean layered styling.',
    'هودي بسحاب معدني ذهبي مزدوج الاتجاه مصنوع من قطن إنترلوك أسود كثيف لإطلالة طبقية أنيقة.',
    'zip',
    2250,
    2600,
    array['S', 'M', 'L', 'XL'],
    '/images/hoodies/sovereign-zip.jpg',
    false,
    true
  ),
  (
    'nocturnal-essential-hoodie',
    'Nocturnal Signature Essential',
    'هودي نوكتورنال سيجنتشر',
    'Everyday luxury essential in deep black cotton with subtle gold ULTIMATE chest monogram and ultra-soft interior.',
    'قطعة أساسية فاخرة للاستخدام اليومي من القطن الأسود مع شعار ULTIMATE الذهبي الدقيق وبطانة فائقة النعومة.',
    'essential',
    1600,
    null,
    array['S', 'M', 'L', 'XL'],
    '/images/hoodies/nocturnal-oversized.jpg',
    false,
    true
  )
on conflict (slug) do nothing;

insert into public.store_sections (slug, label_en, label_ar, sort_order, is_active, show_in_hero)
values
  ('heavyweight', 'Heavyweight', 'ثقيل 520GSM', 1, true, true),
  ('oversized', 'Oversized', 'أوفرسايز', 2, true, true),
  ('zip', 'Gold Zip', 'سحاب ذهبي', 3, true, true),
  ('essential', 'Essential', 'أساسي', 4, true, true)
on conflict (slug) do nothing;

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

-- ============================================================================
-- ADMIN PROMOTION & PROFILE BACKFILL FOR EXISTING AUTH USERS:
-- ============================================================================
insert into public.profiles (id, email, is_admin)
select
  id,
  coalesce(email, ''),
  (lower(coalesce(email, '')) = 'okhatab055@gmail.com')
from auth.users
on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      is_admin = case
        when lower(coalesce(excluded.email, '')) = 'okhatab055@gmail.com' then true
        else public.profiles.is_admin
      end;

update public.profiles
set is_admin = true
where lower(email) = 'okhatab055@gmail.com';
