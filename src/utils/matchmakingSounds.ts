import { isSoundEffectsEnabled } from "@/utils/soundSettings";

const SEARCH_URL = "/aramaSes.mp3";
const FOUND_URL = "/rakipBulunduSes.mp3";
const SEARCH_VOLUME = 0.6;
const FOUND_VOLUME = 0.8;

let searchAudio: HTMLAudioElement | null = null;
let foundAudio: HTMLAudioElement | null = null;

const createAudio = (url: string, volume: number, loop: boolean): HTMLAudioElement => {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.loop = loop;
  audio.setAttribute("playsinline", "true");
  try {
    audio.load();
  } catch {
    /* ignore */
  }
  return audio;
};

const cleanupFoundAudio = () => {
  if (foundAudio) {
    try {
      foundAudio.pause();
      foundAudio.currentTime = 0;
      foundAudio.removeEventListener("ended", cleanupFoundAudio);
      foundAudio.removeEventListener("error", cleanupFoundAudio);
    } catch {
      /* ignore */
    }
    foundAudio = null;
  }
};

export const playMatchmakingSearchSound = () => {
  if (!isSoundEffectsEnabled()) return;
  if (searchAudio) {
    try {
      searchAudio.currentTime = 0;
      searchAudio.play().catch(() => {});
    } catch {
      /* ignore */
    }
    return;
  }

  searchAudio = createAudio(SEARCH_URL, SEARCH_VOLUME, true);
  searchAudio.play().catch(() => {});
};

export const stopMatchmakingSearchSound = () => {
  if (searchAudio) {
    try {
      searchAudio.pause();
      searchAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    searchAudio = null;
  }
};

export const playMatchFoundSound = () => {
  if (!isSoundEffectsEnabled()) return;
  stopMatchmakingSearchSound();

  cleanupFoundAudio();

  foundAudio = createAudio(FOUND_URL, FOUND_VOLUME, false);
  foundAudio.addEventListener("ended", cleanupFoundAudio, { once: true });
  foundAudio.addEventListener("error", cleanupFoundAudio, { once: true });
  foundAudio.play().catch(() => {});
};

export const stopMatchmakingSounds = () => {
  stopMatchmakingSearchSound();
  cleanupFoundAudio();
};
