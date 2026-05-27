## Amaç

1. Ana sayfadaki turnuva kartında "aktif turnuva" sayacı 6–28 arası canlı dalgalansın (rastgele eşleşmedeki gibi).
2. Gerçek bot turnuvaları **arka planda otomatik** oluşturulsun, global olsun (herkes aynı görsün) ve gerçek oyuncu katılınca 8. slotu alıp diğer 7 slot bot ile dolu görünsün.

## Mimari

### A) Ana sayfa sayacı (UI only)
- `useSearchingPlayersCount` mantığına benzer yeni hook: `useActiveTournamentDisplayCount` (6–28 arası, 4–9 sn'de bir küçük adımlarla değişir).
- HomePage'deki `activeTournamentCount` state'i bu hook ile değiştirilir; eski `tournaments` count fetch'i kaldırılır (sadece görsel sayaç).

### B) Bot turnuvaları (gerçek, global, DB'de)
Yeni tablo eklemek gereksiz — mevcut `tournaments` + `tournament_participants` kullanılır.
- Yeni edge function: `ensure-bot-tournaments`
  - Aktif (`status='waiting'`, son 10 dk içinde) bot turnuvası sayısı < N (örn. 3) ise, eksik kadar yeni "bot turnuvası" oluşturur.
  - `creator_id = NULL` (veya özel bir bot sentinel) — `is_bot_tournament` flag eklemek için `tournaments` tablosuna `boolean` kolon eklenir.
  - 7 bot katılımcı eklenir (`tournament_participants` üzerinden `is_bot=true`, benzersiz isim/avatar).
  - `expires_at` 8–15 dk arası random ileri tarih.
- Tetikleme: TournamentPage / HomePage açılınca `supabase.functions.invoke('ensure-bot-tournaments')` (debounce'lu) çağrılır. Cron şart değil, kullanıcı trafiği yeterli.

### C) Gerçek oyuncu katılımı
- TournamentPage zaten `tournaments` listesinden gösterir; bot turnuvaları otomatik listelenecek (7 bot + 1 boş slot → "1/8 boş" görünüm).
- `joinTournament` çağrıldığında gerçek oyuncu 8. slot olarak eklenir. Slotlar zaten bot dolu olduğu için UI'da hemen "8/8" görünür.
- 8. oyuncu katıldığında: yeni edge function `start-bot-tournament-on-full` veya `joinTournament` sonrası client-side kontrol — eğer turnuva bot turnuvasıysa ve real player katıldıysa, `status='in_progress'` ve `next_round_starts_at` set edilir (mevcut start akışı tetiklenir, kurucu kontrolü için `is_bot_tournament` durumunda herhangi bir client başlatabilir).

### D) Turnuva oynanışı
- Bot turnuvalarında mevcut bot eşleşme/maç akışı (round bazlı bot otomasyonu zaten var) kullanılır.

## Veritabanı değişiklikleri

```sql
ALTER TABLE public.tournaments
  ADD COLUMN is_bot_tournament boolean NOT NULL DEFAULT false;
```

## Dosya değişiklikleri

- **Yeni**: `src/hooks/useActiveTournamentDisplayCount.tsx` — 6–28 dalgalanan sayaç.
- **Yeni**: `supabase/functions/ensure-bot-tournaments/index.ts` — eksik bot turnuvalarını üretir.
- **Edit**: `src/pages/HomePage.tsx` — sayaç hook'una geç; turnuva ensure fonksiyonunu mount'ta çağır.
- **Edit**: `src/pages/TournamentPage.tsx` — mount'ta `ensure-bot-tournaments` çağrısı + bot turnuvalarını listede göster (zaten gösterilecek).
- **Edit**: `src/contexts/TournamentContext.tsx` — `joinTournament` sonrası bot turnuvası ise auto-start tetikle; `is_bot_tournament` alanını okumaya başla.

## Açık karar noktaları

1. `creator_id` için: NULL kabul etmiyor olabilir. Çözüm: özel bir "system bot" auth user ID'si veya `creator_id` nullable yap. **Önerim**: `creator_id` nullable + `is_bot_tournament=true` filtreleri.
2. Bot turnuvalarının tutar/giriş ücreti olacak mı? Gerçek oyuncudan 3 kredi alınması mantıklı (zaten mevcut akış); botlar kredi vermez. **Önerim**: kredi alınmaya devam.
3. 8. gerçek oyuncu hiç gelmezse: 10 dk sonra `expires_at` ile cleanup zaten yapılıyor; bot turnuva expire olur. Sorun yok.

Onaylarsan uygulamaya geçerim.