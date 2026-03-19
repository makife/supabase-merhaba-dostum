CREATE OR REPLACE FUNCTION public.deduct_tournament_credits(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  participant record;
  user_profile record;
  deduction_amount int := 3;
  credits_updated int := 0;
  v_bonus int;
  v_game int;
  v_remaining int;
begin
  -- Turnuvadaki bot olmayan, gerçek kullanıcıları döngüye al
  for participant in 
    select user_id 
    from tournament_participants 
    where tournament_id = p_tournament_id and is_bot = false
  loop
    -- Kullanıcının profilini çek
    select * into user_profile from profiles where id = participant.user_id;
    
    -- Profil bulunamazsa atla
    if user_profile is null then
      continue;
    end if;
    
    -- Premium kontrolü (Premium süresi gelecekte mi?)
    if (user_profile.premium_until is not null and user_profile.premium_until > now()) or
       (user_profile.unlimited_lives_until is not null and user_profile.unlimited_lives_until > now()) then
       -- Premium ise kredi düşme, sonraki kişiye geç
       continue;
    end if;

    -- NULL-safe kredi hesaplama
    v_bonus := coalesce(user_profile.bonus_credits, 0);
    v_game := coalesce(user_profile.game_credits, 0);
    
    if v_bonus >= deduction_amount then
      -- Tamamı bonustan düş
      v_bonus := v_bonus - deduction_amount;
    else
      -- Önce bonusu bitir, kalanı game_credits'ten düş
      v_remaining := deduction_amount - v_bonus;
      v_bonus := 0;
      v_game := greatest(0, v_game - v_remaining);
    end if;

    update profiles
    set 
      bonus_credits = v_bonus,
      game_credits = v_game,
      last_credit_refresh = case 
         when coalesce(user_profile.game_credits, 0) >= 5 and v_game < 5 then now()
         else last_credit_refresh
      end
    where id = participant.user_id;
    
    credits_updated := credits_updated + 1;
  end loop;

  return json_build_object('success', true, 'users_deducted', credits_updated);
end;
$$;