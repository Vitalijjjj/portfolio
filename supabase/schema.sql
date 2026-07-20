-- ============================================================
-- Схема для адмінки кейсів (Supabase)
-- Виконайте цей файл у Supabase Dashboard → SQL Editor → Run.
-- ============================================================

-- ---------- Таблиця кейсів ----------

create table if not exists public.cases (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null,
  website_url     text not null,
  image_url       text not null,
  video_url       text,
  category        text not null default 'websites'
                  check (category in ('websites', 'ecommerce', 'ai-site')),
  order_index     integer not null default 1,
  status          text not null default 'draft'
                  check (status in ('draft', 'published')),
  open_in_new_tab boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists cases_order_idx on public.cases (status, category, order_index);

-- updated_at оновлюється автоматично
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
-- Публіка: лише читання опублікованих кейсів.
-- Авторизовані користувачі (адміністратори): повний доступ.

alter table public.cases enable row level security;

drop policy if exists "public read published" on public.cases;
create policy "public read published"
  on public.cases for select
  to anon
  using (status = 'published');

drop policy if exists "admin select" on public.cases;
create policy "admin select"
  on public.cases for select
  to authenticated
  using (true);

drop policy if exists "admin insert" on public.cases;
create policy "admin insert"
  on public.cases for insert
  to authenticated
  with check (true);

drop policy if exists "admin update" on public.cases;
create policy "admin update"
  on public.cases for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "admin delete" on public.cases;
create policy "admin delete"
  on public.cases for delete
  to authenticated
  using (true);

-- ---------- Storage: бакет для медіа ----------

insert into storage.buckets (id, name, public)
values ('case-media', 'case-media', true)
on conflict (id) do nothing;

drop policy if exists "public read case media" on storage.objects;
create policy "public read case media"
  on storage.objects for select
  using (bucket_id = 'case-media');

drop policy if exists "admin upload case media" on storage.objects;
create policy "admin upload case media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'case-media');

drop policy if exists "admin update case media" on storage.objects;
create policy "admin update case media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'case-media');

drop policy if exists "admin delete case media" on storage.objects;
create policy "admin delete case media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'case-media');

-- ---------- Стартові дані (опційно) ----------
-- Розкоментуйте, щоб перенести поточні кейси сайту в базу.
-- УВАГА: шляхи /images/... та /media/... — це файли з репозиторію;
-- нові кейси завантажуйте через адмінку (файли підуть у Storage).

-- insert into public.cases (title, description, website_url, image_url, video_url, category, order_index, status) values
--   ('fuhrmannsoft.com',       'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://www.fuhrmannsoft.com/',       '/images/fuh-poster.jpg',                                   '/media/fuh-demo.mp4', 'websites',  1, 'published'),
--   ('bluepillstudios.com',    'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://www.bluepillstudios.com/',    '/images/68971152cba5d4586c0c196a_duccik-image.webp',       null,                  'websites',  2, 'published'),
--   ('europeangranitellc.com', 'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://www.europeangranitellc.com/', '/images/689711523762f2f611246672_granite-image.webp',      null,                  'websites',  3, 'published'),
--   ('bruitbrothers.com',      'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://www.bruitbrothers.com/',      '/images/68971152916faa50ee175c3e_bruit-image.webp',        null,                  'websites',  4, 'published'),
--   ('beyondxp.in',            'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://www.beyondxp.in/',            '/images/68971152ce3c415a9cd461b2_beyond-image.webp',       null,                  'ecommerce', 1, 'published'),
--   ('Designer Diary',         'Дизайн і розробка сайту: від структури та макета до анімацій і запуску', 'https://community.sivuo.com/dd',      '/images/68deef74c00b66148e78481a_dd-cover.png',            null,                  'ai-site',   1, 'published');
