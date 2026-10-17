-- Concours photo — mise à jour n° 1 (à coller dans SQL Editor > New query > Run)
-- Pendant l'étape « dépôt », chacun ne voit plus que ses propres photos ;
-- l'organisateur, lui, les voit toutes pour pouvoir modérer.
-- Sans danger : remplace seulement deux fonctions, aucune donnée n'est touchée.

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
      from concours_photos p
      -- pendant les dépôts, chacun ne voit que ses propres photos
      where v_phase <> 'depot' or p.appareil = p_appareil), '[]'::json),
    'compte', coalesce((
      select json_object_agg(theme, n) from (
        select theme, count(*) as n from concours_photos group by theme) c), '{}'::json),
    'mes_votes', coalesce((
      select json_object_agg(theme, photo_id) from concours_votes where appareil = p_appareil), '{}'::json)
  );
end $$;

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
        'chemin', p.chemin, 'legende', p.legende,
        'voix', (select count(*) from concours_votes v where v.photo_id = p.id)))
      from concours_photos p), '[]'::json));
end $$;
