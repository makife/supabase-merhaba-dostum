/**
 * Düello (challenge) mini oyunlarından geri dönerken ana sayfada
 * düello görev kartları panelinin yeniden açılmasını sağlar.
 */
export const homeBackPath = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/challenge/")
    ? "/?panel=challenge"
    : "/";
