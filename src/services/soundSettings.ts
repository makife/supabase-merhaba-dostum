/**
 * Merkezi ses efekti ayarı kontrolü.
 *
 * Maç ekranındaki 3 kademeli ses düğmesi (SoundEffectsToggle) ve ayarlar
 * sayfası `kelimeci-settings.sounds` anahtarını yazar. Alt seviye ses
 * servisleri (pitched beep, native audio) bu kontrolü kendileri yapar;
 * böylece ComboBoost gibi hook dışı çağıranlar da kısma ayarına uyar.
 */
export const areSoundEffectsEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem("kelimeci-settings");
    const settings = raw ? JSON.parse(raw) : {};
    return settings.sounds !== false;
  } catch {
    return true;
  }
};
