-- Concours photo — installation Supabase
-- À coller UNE fois dans Supabase > SQL Editor > New query, puis « Run ».
-- ⚠️ Remplacez d'abord CHANGEZ-MOI (ligne « insert into concours_config ») par
--    votre code organisateur : c'est lui qui permet de changer d'étape et de modérer.
--
-- Sécurité : les tables n'ont AUCUNE politique d'accès direct. Le navigateur ne
-- passe que par les fonctions ci-dessous (security definer), qui vérifient l'étape
-- en cours. L'identifiant d'appareil n'est jamais renvoyé aux autres visiteurs.

create table if not exists public.concours_config (
  id     int  primary key default 1 check (id = 1),
  phase  text not null default 'depot' check (phase in ('depot', 'vote', 'resultats')),
  secret text not null
);
insert into public.concours_config (secret) values ('CHANGEZ-MOI') on conflict (id) do nothing;

create table if not exists public.concours_photos (
  id        uuid primary key default gen_random_uuid(),
  theme     text not null check (theme in ('biere', 'tutu', 'celine', 'cliche', 'blocus')),
  appareil  uuid not null,
  pseudo    text not null check (char_length(pseudo) between 1 and 40),
  legende   text not null default '' check (char_length(legende) <= 80),
  chemin    text not null,
  cree_le   timestamptz not null default now(),
  unique (theme, appareil)
);

create table if not exists public.concours_votes (
  appareil uuid not null,
  theme    text not null,
  photo_id uuid not null references public.concours_photos(id) on delete cascade,
  primary key (appareil, theme)
);

alter table public.concours_config enable row level security;
alter table public.concours_photos enable row level security;
alter table public.concours_votes  enable row level security;

-- Stockage des photos : public en lecture, dépôt anonyme limité à 5 Mo d'images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('concours', 'concours', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "concours depot anonyme" on storage.objects;
create policy "concours depot anonyme" on storage.objects
  for insert to anon with check (bucket_id = 'concours');

-- ── Lecture de l'état (tout le monde) ──────────────────────────────────────
create or replace function public.concours_etat(p_appareil uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_phase text;
begin
  select phase into v_phase from concours_config where id = 1;
  return json_build_object(
    'phase', v_phase,
    'photos', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'theme', p.theme, 'legende', p.legende, 'chemin', p.chemin,
        'moi', p.appareil = p_appareil,
        -- les auteurs restent anonymes jusqu'aux résultats (sauf pour soi)
        'pseudo', case when v_phase = 'resultats' or p.appareil = p_appareil then p.pseudo end,
        'voix', case when v_phase = 'resultats'
                     then (select count(*) from concours_votes v where v.photo_id = p.id) end
      ) order by p.cree_le)
      from concours_photos p), '[]'::json),
    'mes_votes', coalesce((
      select json_object_agg(theme, photo_id) from concours_votes where appareil = p_appareil), '{}'::json)
  );
end $$;

-- ── Dépôt / remplacement / retrait de sa photo (étape « dépôt ») ───────────
create or replace function public.concours_deposer(
  p_appareil uuid, p_theme text, p_pseudo text, p_legende text, p_chemin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select phase from concours_config where id = 1) <> 'depot' then
    raise exception 'Les dépôts sont fermés';
  end if;
  if p_chemin not like p_theme || '/%'
     or not exists (select 1 from storage.objects where bucket_id = 'concours' and name = p_chemin) then
    raise exception 'Photo introuvable';
  end if;
  insert into concours_photos (theme, appareil, pseudo, legende, chemin)
  values (p_theme, p_appareil, left(trim(p_pseudo), 40), left(coalesce(trim(p_legende), ''), 80), p_chemin)
  on conflict (theme, appareil) do update
    set pseudo = excluded.pseudo, legende = excluded.legende, chemin = excluded.chemin, cree_le = now();
end $$;

create or replace function public.concours_legende(p_appareil uuid, p_theme text, p_legende text)
returns void language sql security definer set search_path = public as $$
  update concours_photos set legende = left(coalesce(trim(p_legende), ''), 80)
  where appareil = p_appareil and theme = p_theme
    and (select phase from concours_config where id = 1) = 'depot';
$$;

create or replace function public.concours_retirer(p_appareil uuid, p_theme text)
returns void language sql security definer set search_path = public as $$
  delete from concours_photos
  where appareil = p_appareil and theme = p_theme
    and (select phase from concours_config where id = 1) = 'depot';
$$;

-- ── Vote : une voix par thème, jamais pour sa propre photo (étape « vote ») ─
create or replace function public.concours_voter(p_appareil uuid, p_theme text, p_photo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select phase from concours_config where id = 1) <> 'vote' then
    raise exception 'Le vote est fermé';
  end if;
  if p_photo_id is null then
    delete from concours_votes where appareil = p_appareil and theme = p_theme;
    return;
  end if;
  if not exists (select 1 from concours_photos
                 where id = p_photo_id and theme = p_theme and appareil <> p_appareil) then
    raise exception 'Vote impossible pour cette photo';
  end if;
  insert into concours_votes (appareil, theme, photo_id) values (p_appareil, p_theme, p_photo_id)
  on conflict (appareil, theme) do update set photo_id = excluded.photo_id;
end $$;

-- ── Organisation (code organisateur) ───────────────────────────────────────
create or replace function public.concours_admin_decompte(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select secret from concours_config where id = 1) then
    raise exception 'Code organisateur incorrect';
  end if;
  return json_build_object(
    'votants', (select count(distinct appareil) from concours_votes),
    'photos', coalesce((
      select json_agg(json_build_object(
        'id', p.id, 'theme', p.theme, 'pseudo', p.pseudo,
        'voix', (select count(*) from concours_votes v where v.photo_id = p.id)))
      from concours_photos p), '[]'::json));
end $$;

create or replace function public.concours_admin_phase(p_secret text, p_phase text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select secret from concours_config where id = 1) then
    raise exception 'Code organisateur incorrect';
  end if;
  update concours_config set phase = p_phase where id = 1;
end $$;

create or replace function public.concours_admin_retirer(p_secret text, p_photo_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from (select secret from concours_config where id = 1) then
    raise exception 'Code organisateur incorrect';
  end if;
  delete from concours_photos where id = p_photo_id;
end $$;

revoke all on function public.concours_etat(uuid)                                from public;
revoke all on function public.concours_deposer(uuid, text, text, text, text)     from public;
revoke all on function public.concours_legende(uuid, text, text)                 from public;
revoke all on function public.concours_retirer(uuid, text)                       from public;
revoke all on function public.concours_voter(uuid, text, uuid)                   from public;
revoke all on function public.concours_admin_decompte(text)                      from public;
revoke all on function public.concours_admin_phase(text, text)                   from public;
revoke all on function public.concours_admin_retirer(text, uuid)                 from public;
grant execute on function public.concours_etat(uuid)                            to anon;
grant execute on function public.concours_deposer(uuid, text, text, text, text) to anon;
grant execute on function public.concours_legende(uuid, text, text)             to anon;
grant execute on function public.concours_retirer(uuid, text)                   to anon;
grant execute on function public.concours_voter(uuid, text, uuid)               to anon;
grant execute on function public.concours_admin_decompte(text)                  to anon;
grant execute on function public.concours_admin_phase(text, text)               to anon;
grant execute on function public.concours_admin_retirer(text, uuid)             to anon;
