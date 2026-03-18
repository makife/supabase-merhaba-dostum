import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { usePremiumDailyRewards } from "@/hooks/usePremiumDailyRewards";
// useMemoryGame artık MiniGamesPage'de kullanılıyor
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
import LeaderboardPrizeDialog from "@/components/LeaderboardPrizeDialog";
import ChallengePrizeDialog from "@/components/ChallengePrizeDialog";
import { useSearchingPlayersCount } from "@/hooks/useSearchingPlayersCount";

import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  Crown,
  Zap,
  Gift,
  Star,
  Flame,
  Gamepad2,
  Sparkles,
  Check,
} from "lucide-react";
import { getDailyChallengeStatus, ChallengeType } from "@/hooks/useDailyChallenge";

// --- YARDIMCI SABİTLER ---

const greetingMessages = [
  "Sahne senin! 🌟",
  "Bugün şanslı günün! 🍀",
  "Enerjin harika! ⚡",
  "Rekor kırmaya hazır mısın? 🚀",
  "Şampiyon geldi! 👑",
  "Mükemmel gözüküyorsun 🧿",
  "Zihinler hazırsa başlıyoruz! 🧠",
  "Bugün skor tabelası yanacak! 🔥",
  "Hızına kimse yetişemez! 💨",
  "Efsane bir oyun seni bekliyor! 🎯",
  "Odak moduna geç! 🎧",
  "Rakipler titreyecek! 😎",
  "Bugün fark atma günü! 💥",
  "Kontrol sende! 🎮",
  "Stratejini konuştur! ♟️",
  "Bu tur senin turun! 🔄",
  "Şimdi göster kendini! 💪",
  "Skorları alt üst et! 📊",
  "Hazırsan zaman başlıyor! ⏳",
  "Bugün zirveye oynuyoruz! 🏆",
  "Seri başlasın! 🔁",
  "Reflekslerine güven! ⚔️",
  "Büyük hamle zamanı! 🎲",
  "Mod: Kazanma 🔓",
  "Bugün MVP sensin! ⭐",
  "Hedef: Rekor! 🎯",
  "Oyun seni bekliyordu! 👀",
  "Başarı senin ikinci adın! 🏅",
  "Bir efsane doğuyor... 🌌",
  "Tam isabet zamanı! 🎯",
  "Bugün kimse seni durduramaz! 🛑",
  "Zirve modu aktif! 🚨",
  "Hadi tarih yazalım! 📖",
];

const getRandomGreeting = () =>
  greetingMessages[Math.floor(Math.random() * greetingMessages.length)].toLocaleUpperCase("tr-TR");

const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  // 🔧 FIX: Math.floor kullanarak tutarlı hesaplama
  const daysDiff = Math.floor((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const isUnlimitedLivesActive = (profile: any) => {
  if (!profile?.unlimited_lives_until) return false;
  const expiry = new Date(profile.unlimited_lives_until);
  return expiry > new Date();
};

// 2 saatten fazla kaldıysa "maraton" (24h), değilse "kısa" (1h)
const getUnlimitedType = (profile: any): "maraton" | "short" | null => {
  if (!profile?.unlimited_lives_until) return null;
  const expiry = new Date(profile.unlimited_lives_until);
  const now = new Date();
  if (expiry <= now) return null;
  const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursLeft > 2 ? "maraton" : "short";
};

const getVipType = (profile: any): "yearly" | "monthly" | "short" | null => {
  if (!profile?.premium_until) return null;
  const now = new Date();
  const premiumUntil = new Date(profile.premium_until);
  if (premiumUntil <= now) return null;
  // 🔧 FIX: Math.floor kullanarak tutarlı hesaplama
  const daysRemaining = Math.floor((premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysRemaining >= 300) return "yearly";
  if (daysRemaining >= 25) return "monthly";
  return "short";
};

// --- BİLEŞENLER ---

const StatWidget = memo(({ icon: Icon, value, label, colorClass }: any) => (
  <div className="flex-1 bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
    <Icon className={`w-5 h-5 mb-1 text-${colorClass}-400`} />
    <span className="text-lg font-bold text-white tracking-tight">{value}</span>
    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide opacity-80">{label}</span>
  </div>
));
StatWidget.displayName = "StatWidget";

const VipCrownIcon = ({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 511.998 511.998" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M501.287,36.904v277.65c0,15.328-12.424,27.752-27.752,27.752H38.468c-15.328,0-27.752-12.424-27.752-27.752V36.904c0-15.328,12.424-27.752,27.752-27.752h435.067C488.863,9.153,501.287,21.576,501.287,36.904z" style={{fill:'#E4EAEA'}}/>
    <path d="M501.287,36.904v29.607H10.717V36.904c0-15.328,12.424-27.752,27.752-27.752h435.067C488.863,9.153,501.287,21.576,501.287,36.904z" style={{fill:'#F23488'}}/>
    <polyline points="180.704,373.999 138.357,470.47 185.525,463.197 212.105,502.847 251.45,413.21 260.542,413.21 299.887,502.847 326.467,463.197 373.635,470.47 331.287,373.999" style={{fill:'#F23488'}}/>
    <path d="M340.286,315.053c0-16.659,8.903-35.863,1.12-49.316c-8.03-13.878-29.386-15.667-43.264-23.697c-13.452-7.784-25.485-25.595-42.145-25.595s-28.692,17.813-42.145,25.595c-13.878,8.03-35.234,9.819-43.264,23.697c-7.784,13.452,1.12,32.658,1.12,49.316c0,16.659-8.903,35.863-1.12,49.316c8.03,13.878,29.386,15.667,43.264,23.697c13.452,7.784,25.485,25.595,42.145,25.595s28.692-17.813,42.145-25.595c13.878-8.03,35.234-9.819,43.264-23.697C349.189,350.917,340.286,331.711,340.286,315.053z" style={{fill:'#EA9B22'}}/>
    <circle style={{fill:'#F23488'}} cx="255.999" cy="315.054" r="46.484"/>
    <path d="M146.666,342.306c0-5.055-4.098-9.153-9.153-9.153H38.467c-10.255,0-18.599-8.344-18.599-18.599v-126.62c0-5.055-4.098-9.153-9.153-9.153s-9.153,4.098-9.153,9.153v126.62c0,20.349,16.556,36.904,36.904,36.904h99.046C142.568,351.458,146.666,347.36,146.666,342.306z"/>
    <path d="M473.535,0H38.468C18.118,0,1.563,16.556,1.563,36.904V66.44c0,0.024-0.004,0.048-0.004,0.071s0.004,0.048,0.004,0.071v90.843c0,5.055,4.098,9.153,9.153,9.153s9.153-4.098,9.153-9.153V75.664h322.886c5.055,0,9.153-4.098,9.153-9.153s-4.098-9.153-9.153-9.153H19.868V36.904c0-10.255,8.344-18.599,18.599-18.599h435.067c10.255,0,18.599,8.344,18.599,18.599v20.454H373.264c-5.055,0-9.153,4.098-9.153,9.153s4.098,9.153,9.153,9.153h118.869v238.89c0,10.255-8.343,18.599-18.599,18.599h-99.059c-5.055,0-9.153,4.098-9.153,9.153c0,5.055,4.098,9.153,9.153,9.153h99.059c20.349,0,36.904-16.556,36.904-36.904V36.904C510.439,16.556,493.884,0,473.535,0z"/>
    <path d="M255.997,370.692c30.679,0,55.64-24.959,55.64-55.639c0-30.68-24.961-55.64-55.64-55.64s-55.639,24.959-55.639,55.64C200.358,345.732,225.318,370.692,255.997,370.692z M255.997,277.719c20.585,0,37.334,16.749,37.334,37.334s-16.749,37.333-37.334,37.333s-37.333-16.747-37.333-37.333C218.664,294.468,235.412,277.719,255.997,277.719z"/>
  </svg>
);

const WheelIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <g id="s">
      <polygon fill="#9fa9b6" fillRule="evenodd" points="41.31 54.7 41.31 46.62 30.28 44.01 18.31 46.24 18.31 54.7 30.87 58.09 41.31 54.7"/>
      <path d="M30.28,44.01l-11.97,2.22v2.96c3.43,2.15,7.49,3.4,11.84,3.4,4.03,0,7.85-1.08,11.16-2.99v-2.98l-11.03-2.61Z" fill="#8996a8" fillRule="evenodd"/>
      <polygon fill="#e4ecf0" fillRule="evenodd" points="23.35 54.7 23.35 48.56 29.67 47.2 36.28 48.78 36.28 54.7 29.31 56.57 23.35 54.7"/>
      <path d="M29.67,47.2l-6.32,1.36v2.97c2.14,.69,4.43,1.06,6.8,1.06,2.11,0,4.17-.3,6.13-.86v-2.95l-6.61-1.58Z" fill="#d9e3e9" fillRule="evenodd"/>
      <path d="M16.7,54.7h26.23c1.19,0,2.15,.96,2.15,2.15s-.96,2.15-2.15,2.15H16.7c-1.19,0-2.15-.96-2.15-2.15s.96-2.15,2.15-2.15Z" fill="#f0f3f5" fillRule="evenodd"/>
      <path d="M39.62,54.7c1.19,0,2.15,.96,2.15,2.15s-.96,2.15-2.15,2.15h3.31c1.19,0,2.15-.96,2.15-2.15s-.96-2.15-2.15-2.15h-3.31Z" fill="#e4ecf0" fillRule="evenodd"/>
      <path d="M51.79,32.78c-2.5,9.91-11.42,16.85-21.64,16.85-12.33,0-22.32-9.99-22.32-22.32S17.83,5,30.15,5c10.22,0,19.14,6.95,21.64,16.86v10.93Z" fill="#8996a8" fillRule="evenodd"/>
      <path d="M30.15,5c-.61,0-1.22,.03-1.82,.08,9.41,.8,17.39,7.49,19.73,16.78,.96,4.33,.41,7.58,0,10.93-2.35,9.29-10.33,15.97-19.74,16.77,.6,.05,1.21,.08,1.82,.08,10.22,0,19.14-6.94,21.64-16.85v-10.93c-2.5-9.91-11.42-16.86-21.64-16.86Z" fill="#7a8594" fillRule="evenodd"/>
      <path d="M41.54,38.7c2.06-2.06,3.52-4.64,4.23-7.46l1.22-3.93-5.48-11.36c-3.01-3.02-7.1-4.73-11.36-4.74l-11.34,4.76c-3.02,3-4.74,7.08-4.76,11.34l4.72,11.38c3.02,3.02,7.11,4.72,11.38,4.72l11.39-4.72Z" fill="#e8a3c1" fillRule="evenodd"/>
      <path d="M30.15,27.32V11.22c-4.26,.02-8.34,1.73-11.34,4.76l11.34,11.34Z" fill="#f0f3f5" fillRule="evenodd"/>
      <path d="M30.15,27.32H14.05c0,4.27,1.7,8.36,4.72,11.38l11.38-11.38Z" fill="#f0f3f5" fillRule="evenodd"/>
      <path d="M30.15,27.32v16.1c4.27,0,8.37-1.7,11.39-4.72l-11.39-11.39Z" fill="#f0f3f5" fillRule="evenodd"/>
      <path d="M46.99,27.32l-1.22-3.93c-.72-2.82-2.19-5.39-4.26-7.43l-11.36,11.36h16.84Z" fill="#f0f3f5" fillRule="evenodd"/>
      <path d="M51.15,32.82c-4.85,0-9.62-5.5-9.62-5.5,0,0,4.77-5.5,9.62-5.5,3.04,0,5.01,2.46,5.01,5.5s-1.98,5.5-5.01,5.5Z" fill="#f5e680" fillRule="evenodd"/>
      <path d="M51.15,21.82c-.39,0-.77,.04-1.15,.1,2.45,.49,3.98,2.72,3.98,5.4s-1.54,4.91-3.98,5.4c.38,.06,.77,.1,1.15,.1,3.04,0,5.01-2.46,5.01-5.5s-1.97-5.5-5.01-5.5Z" fill="#f2d865" fillRule="evenodd"/>
      <path d="M52.55,33.65c2.74-.63,4.62-3.09,4.62-6.34s-1.88-5.71-4.62-6.34c-2.84-10.02-11.92-16.98-22.39-16.98C17.29,4,6.83,14.46,6.83,27.32c0,8.12,4.17,15.27,10.48,19.45v6.94h-.62c-1.74,0-3.15,1.41-3.15,3.15s1.41,3.15,3.15,3.15h26.23c1.74,0,3.15-1.41,3.15-3.15s-1.41-3.15-3.15-3.15h-.62v-6.56c4.87-2.99,8.6-7.71,10.23-13.49Zm2.62-6.34c0,2.65-1.65,4.5-4.01,4.5-3.38,0-6.86-3.12-8.24-4.5,1.38-1.39,4.85-4.5,8.24-4.5,2.36,0,4.01,1.85,4.01,4.5Zm-34.91,11.31l8.9-8.9v12.59c-3.4-.23-6.48-1.57-8.9-3.69Zm-5.1-10.31h12.59l-8.9,8.9c-2.12-2.42-3.46-5.5-3.69-8.9Zm24.93-12.34l-8.93,8.93V12.3c3.4,.22,6.5,1.54,8.93,3.67Zm4.57,7.28c-1.69,1.18-2.99,2.46-3.56,3.06h-8.53l8.95-8.95c1.45,1.66,2.52,3.66,3.14,5.89Zm-15.5,1.65l-8.9-8.9c2.42-2.12,5.5-3.46,8.9-3.69v12.59Zm-10.31-7.49l8.9,8.9H15.15c.23-3.4,1.57-6.48,3.69-8.9Zm12.31,12.31l8.93,8.93c-2.43,2.13-5.54,3.45-8.93,3.67v-12.6Zm10.36,7.53l-8.95-8.95h8.53c.57,.6,1.87,1.88,3.56,3.06-.62,2.23-1.7,4.23-3.14,5.89Z"/>
    </g>
  </svg>
);

const UnlimitedIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M27.2272 27.5333L29.8363 26.2578C31.2162 24.4322 32.1695 22.3314 32.6211 20.1055C33.2483 16.7292 31.3416 15.2036 31.7932 14.6784C33.3738 12.8027 36.0833 14.9535 37.0367 17.0293C37.4381 18.705 37.4381 20.4306 37.0367 22.1063L44.8893 18.9801C47.097 19.6553 46.1437 22.1313 46.1437 22.1313C46.6454 22.2063 47.097 22.4564 47.3981 22.8315C47.7242 23.2067 47.8999 23.7069 47.8748 24.1821C47.8497 24.5322 47.7493 24.8573 47.5988 25.1574C47.4483 25.4575 47.2225 25.7326 46.9465 25.9327C46.9465 25.9327 49.3801 27.7084 47.0719 29.4841C48.0504 30.4845 48.6023 31.4598 47.7995 32.7103C41.3769 35.3113 38.6423 37.312 35.8073 36.5618L31.8936 38.2874L27.2272 27.5333Z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M28.9834 25.1825L25.4961 26.8831L31.1409 40.0381L35.9077 37.9623C37.2123 38.1624 38.567 38.0374 39.7964 37.5622C41.8285 36.8869 44.3875 35.5364 48.2762 33.9608L48.6776 33.8108L48.9034 33.4356C49.355 32.7854 49.5557 31.9851 49.4553 31.1848C49.3801 30.6095 49.1543 30.0343 48.803 29.5591C49.1292 29.109 49.3048 28.5838 49.355 28.0336C49.3801 27.3083 49.1794 26.608 48.7779 26.0078C48.7278 25.9578 48.7027 25.9078 48.6776 25.8577C48.9786 25.3575 49.1543 24.8073 49.1794 24.2321C49.2044 23.6319 49.0539 23.0567 48.7779 22.5315C48.502 22.0063 48.0755 21.5811 47.5737 21.256C47.6991 20.4807 47.5235 19.6554 47.097 19.0051C46.6705 18.3299 45.9932 17.8547 45.2154 17.6546L44.7638 17.5046L38.5921 19.9555C38.7176 18.78 38.5921 17.5796 38.2158 16.4542C37.4883 14.7785 36.1335 13.453 34.4526 12.7778C33.8003 12.5277 33.0978 12.4776 32.4204 12.6527C31.7431 12.8278 31.1409 13.2279 30.7144 13.7531C30.5137 13.9782 30.3883 14.2783 30.3381 14.5534C30.2879 14.8285 30.313 15.1537 30.4134 15.4288C31.166 16.7293 31.4671 18.2298 31.2413 19.7054C30.8399 21.7062 30.0621 23.5319 28.9834 25.1825ZM27.2272 27.5334L29.8364 26.2579C31.2162 24.4572 32.1696 22.3314 32.5961 20.1055C33.2233 16.7293 31.3166 15.2037 31.7681 14.6785C33.3487 12.8028 36.0582 14.9536 37.0116 17.0294C37.413 18.705 37.413 20.4307 37.0116 22.1063L44.8642 18.9801C47.0719 19.6554 46.1186 22.1313 46.1186 22.1313C46.6204 22.2063 47.0719 22.4564 47.373 22.8316C47.6992 23.2067 47.8748 23.7069 47.8497 24.1821C47.8246 24.5322 47.7242 24.8574 47.5486 25.1575C47.3981 25.4576 47.1723 25.7327 46.8963 25.9328C46.8963 25.9328 49.3299 27.7084 47.0218 29.4841C48.0253 30.4845 48.5521 31.4599 47.7744 32.7103C41.3518 35.3113 38.6172 37.3121 35.7572 36.5618L31.8434 38.2875L27.2272 27.5334Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M41.6278 24.9324L47.5737 22.3314L47.0469 21.106L41.0759 23.7069L41.6278 24.9324Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M43.3087 28.6089L48.5522 26.358L48.0253 25.1326L42.7568 27.3834L43.3087 28.6089Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M44.6635 31.7099L47.3479 30.5345L48.778 30.0093L48.3013 28.7588L46.8713 29.309L44.1617 30.4844L44.6635 31.7099Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M26.9261 25.8328L24.066 27.0582L29.9116 40.6634L32.7716 39.4379L26.9261 25.8328Z" fill="#31CEA8"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M33.8505 39.8881L27.3526 24.7573L23.0626 26.608L29.5604 41.7388L33.8505 39.8881ZM26.9261 25.8327L24.0661 27.0582L29.9116 40.6634L32.7717 39.4379L26.9261 25.8327Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M21.758 33.1355C23.3385 32.5102 25.0696 32.3852 26.7254 32.7603C28.3813 33.1105 29.8866 33.9608 31.0657 35.1863C32.2448 36.4117 33.0226 37.9373 33.3487 39.5879C33.6498 41.2386 33.4491 42.9642 32.7968 44.5148C32.1194 46.0654 31.0155 47.3909 29.5855 48.3163C28.1555 49.2416 26.4996 49.7168 24.8187 49.6918C23.1127 49.6668 21.482 49.1666 20.0771 48.2162C18.6721 47.2658 17.5933 45.9153 16.941 44.3647C16.5145 43.3143 16.2888 42.1889 16.3138 41.0385C16.3389 39.888 16.5647 38.7876 17.0163 37.7372C17.4679 36.6868 18.1202 35.7615 18.9481 34.9612C19.7258 34.1859 20.7043 33.5606 21.758 33.1355Z" fill="#A694FE"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M21.0053 31.2597C19.0735 32.085 17.4428 33.4605 16.2887 35.1862C15.1347 36.9369 14.5325 38.9876 14.5576 41.0634C14.5827 43.1392 15.2099 45.19 16.3891 46.9156C17.5682 48.6413 19.224 49.9918 21.1558 50.7671C23.0876 51.5674 25.2201 51.7675 27.2774 51.3423C29.3346 50.9422 31.2162 49.9168 32.6964 48.4412C34.1766 46.9657 35.1801 45.09 35.6066 43.0392C36.008 40.9884 35.8073 38.8626 35.0296 36.9369C33.9257 34.3359 31.8434 32.2601 29.2091 31.2097C26.5749 30.1593 23.6145 30.1843 21.0053 31.2597ZM21.758 33.1354C23.3385 32.5102 25.0696 32.3851 26.7254 32.7603C28.3812 33.1354 29.8865 33.9607 31.0657 35.1862C32.2448 36.4117 33.0226 37.9372 33.3487 39.5879C33.6498 41.2385 33.4491 42.9641 32.7968 44.5147C32.1194 46.0653 31.0155 47.3908 29.5855 48.3162C28.1554 49.2415 26.4996 49.7167 24.8187 49.6917C23.1127 49.6667 21.482 49.1665 20.077 48.2161C18.6721 47.2658 17.5933 45.9153 16.941 44.3647C16.5145 43.3143 16.2887 42.1888 16.3138 41.0384C16.3138 39.913 16.5647 38.7876 17.0163 37.7372C17.4679 36.6868 18.1202 35.7614 18.9481 34.9611C19.7258 34.1858 20.7042 33.5606 21.758 33.1354Z" fill="#2A2941"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M24.5678 40.8885L21.5573 42.164L21.9085 42.9893L25.7721 41.3887L24.0912 37.1621L23.2382 37.5122L24.5678 40.8885Z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M23.4389 21.8062C22.8618 21.231 22.4604 20.5308 22.2346 19.7555C22.335 19.5054 22.5106 19.3053 22.7615 19.1802C23.0124 19.0802 23.2883 19.0552 23.5392 19.1552C24.0159 19.8055 24.3169 20.5808 24.3922 21.3811C24.3922 21.7312 23.7399 22.0063 23.4389 21.8062Z" fill="#4C5EFD"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M19.8763 24.9823C19.0986 24.7822 18.3711 24.3821 17.794 23.8319C17.5682 23.4567 18.1453 22.6064 18.6219 22.6564C19.3495 22.9565 20.0018 23.4567 20.4785 24.082C20.6541 24.4571 20.2276 25.0323 19.8763 24.9823Z" fill="#4C5EFD"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M18.4714 29.309C17.7187 29.5591 16.8908 29.6341 16.1131 29.4841C15.7117 29.284 15.7368 28.2586 16.1131 28.0585C16.9159 27.9335 17.7187 27.9835 18.4965 28.2586C18.5717 28.3336 18.6219 28.4087 18.6721 28.5087C18.7222 28.6087 18.7222 28.7088 18.7222 28.8088C18.7222 28.9088 18.6972 29.0089 18.6721 29.1089C18.5968 29.1589 18.5466 29.259 18.4714 29.309Z" fill="#4C5EFD"/>
  </svg>
);

const RastgeleIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512.001 512.001" xmlns="http://www.w3.org/2000/svg">
    <path style={{fill:"#3A4DE2"}} d="M448.595,376.555h-99.072c-46.54,0-88.552-25.772-109.641-67.258l-45.657-89.815c-14.744-29.002-44.112-47.018-76.647-47.018H18.507C8.286,172.465,0,164.179,0,153.958s8.286-18.507,18.507-18.507h99.072c46.54,0,88.552,25.772,109.641,67.259l45.657,89.815c14.744,29.001,44.112,47.018,76.647,47.018h99.072C473.05,339.542,473.074,376.555,448.595,376.555z"/>
    <path style={{fill:"#3A4DE2"}} d="M385.173,403.617v-91.149c0-18.43,19.996-29.944,35.929-20.743l78.937,45.573c15.961,9.215,15.933,32.288,0,41.487l-78.937,45.574C405.147,433.574,385.173,422.02,385.173,403.617z"/>
    <path style={{fill:"#FF52A0"}} d="M117.579,376.549c-10.221,0-18.507-8.286-18.507-18.507s8.286-18.507,18.507-18.507c32.535,0,61.903-18.016,76.647-47.018l45.657-89.815c21.089-41.487,63.101-67.258,109.641-67.258h99.072c24.455,0,24.481,37.013,0,37.013h-99.072c-32.535,0-61.905,18.016-76.647,47.018l-45.657,89.815C206.13,350.777,164.118,376.549,117.579,376.549z"/>
    <path style={{fill:"#FF52A0"}} d="M53.496,376.549h-34.99C8.286,376.549,0,368.263,0,358.043s8.286-18.507,18.507-18.507h34.99c10.221,0,18.507,8.286,18.507,18.507S63.718,376.549,53.496,376.549z"/>
    <path style={{fill:"#FF52A0"}} d="M421.103,87.639l78.937,45.574c15.96,9.215,15.935,32.288,0,41.487l-78.937,45.574c-15.96,9.215-35.929-2.344-35.929-20.743v-91.149C385.173,89.957,405.165,78.436,421.103,87.639z"/>
  </svg>
);

const TurnuvaIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
    <defs>
      <linearGradient id="tg1" gradientUnits="userSpaceOnUse" x1="128" y1="172" x2="128" y2="32">
        <stop offset="0" stopColor="#fc9502"/>
        <stop offset="1" stopColor="#fcbe02"/>
      </linearGradient>
    </defs>
    <path fill="#fcc402" fillRule="evenodd" d="M63,224 C89.509,224 111,202.51 111,176 L111,154 L145,154 L145,176 C145,202.51 167,224 193,224 C219,224 29.42,224 63,224 Z"/>
    <path fill="#fce202" fillRule="evenodd" d="M193,256 L63,256 C54.163,256 47,248.836 47,240 C47,231.163 54.163,224 63,224 C72.287,224 183.976,224 193,224 C201.836,224 209,231.163 209,240 C209,248.836 201.836,256 193,256 Z"/>
    <path fill="#fce202" fillRule="evenodd" d="M248,62 L236,62 C217.222,62 201,77.222 201,96 L195,96 L195,62 C197.78,48.307 209.486,38 224,38 L248,38 C252.418,38 256,41.582 256,46 L256,54 C256,58.418 252.418,62 248,62 ZM20,62 L8,62 C3.582,62 0,58.418 0,54 L0,46 C0,41.582 3.582,38 8,38 L32,38 C46.513,38 58.22,48.307 61,62 L61,96 L55,96 C55,77.222 38.778,62 20,62 Z"/>
    <path fill="url(#tg1)" fillRule="evenodd" d="M54,32 L202,32 L202,98 C202,138.869 168.869,172 128,172 C87.131,172 54,138.869 54,98 L54,32 Z"/>
    <path fill="#fcc402" fillRule="evenodd" d="M52,0 L204,0 C208.418,0 212,3.582 212,8 L212,16 C212,20.418 208.418,24 204,24 L52,24 C47.582,24 44,20.418 44,16 L44,8 C44,3.582 47.582,0 52,0 Z"/>
    <path fill="#ffffff" fillRule="evenodd" d="M162.856,90.349 C157.186,96.253 149.864,104.224 149.864,104.224 C149.864,104.224 151.121,114.155 152.104,122.143 C153.122,130.408 148.536,129.653 143.551,127.407 C136.369,124.171 128,120.112 128,120.112 C128,120.112 119.631,124.171 112.449,127.407 C107.464,129.653 102.877,130.408 103.895,122.143 C104.879,114.155 106.136,104.224 106.136,104.224 C106.136,104.224 98.814,96.253 93.144,90.349 C90.272,87.359 89.502,83.284 95.639,82.135 C103.704,80.624 114.487,78.513 114.487,78.513 C114.487,78.513 119.123,67.961 123.261,60.785 C125.386,57.099 130.614,57.099 132.739,60.785 C136.877,67.961 141.513,78.513 141.513,78.513 C141.513,78.513 152.296,80.624 160.361,82.135 C166.497,83.284 165.728,87.359 162.856,90.349 Z"/>
  </svg>
);

const AiModIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <path style={{fill:"#93C7EF"}} d="M302.545,69.818c0-25.707-20.84-46.545-46.545-46.545s-46.545,20.838-46.545,46.545c0,17.225,9.365,32.254,23.273,40.304v83.818h46.545v-83.818C293.181,102.073,302.545,87.043,302.545,69.818z"/>
    <path style={{fill:"#5A8BB0"}} d="M256,23.273v170.667h23.273v-83.818c13.908-8.049,23.273-23.077,23.273-40.304C302.545,44.111,281.705,23.273,256,23.273z"/>
    <rect y="240.485" style={{fill:"#93C7EF"}} width="248.242" height="124.121"/>
    <rect x="263.758" y="240.485" style={{fill:"#5A8BB0"}} width="248.242" height="124.121"/>
    <rect x="186.182" y="364.606" style={{fill:"#93C7EF"}} width="139.636" height="124.121"/>
    <rect x="256" y="364.606" style={{fill:"#5A8BB0"}} width="69.818" height="124.121"/>
    <rect x="46.545" y="162.909" style={{fill:"#CCE9F9"}} width="418.909" height="279.273"/>
    <rect x="256" y="162.909" style={{fill:"#93C7EF"}} width="209.455" height="279.273"/>
    <path style={{fill:"#3C5D76"}} d="M193.939,271.515c0,17.138-13.894,31.03-31.03,31.03c-17.136,0-31.03-13.892-31.03-31.03c0-17.138,13.894-31.03,31.03-31.03C180.046,240.485,193.939,254.377,193.939,271.515z"/>
    <path style={{fill:"#1E2E3B"}} d="M380.121,271.515c0,17.138-13.894,31.03-31.03,31.03c-17.137,0-31.03-13.892-31.03-31.03c0-17.138,13.894-31.03,31.03-31.03C366.227,240.485,380.121,254.377,380.121,271.515z"/>
    <path style={{fill:"#3C5D76"}} d="M186.182,349.091c0,38.558,31.258,69.818,69.818,69.818c38.558,0,69.818-31.26,69.818-69.818H186.182z"/>
    <path style={{fill:"#1E2E3B"}} d="M256,349.091c0,38.558,0,46.545,0,69.818c38.558,0,69.818-31.26,69.818-69.818H256z"/>
  </svg>
);

const OzelOdaIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <path d="M856.906011 242.071064l-97.660231-97.726783c-31.252052-31.105636-75.462396-48.946838-121.29867-48.946838-45.902827 0-90.1101 17.841202-121.362152 49.076872l-16.734381 16.73131c-32.422353 32.295391-50.263554 75.398915-50.263555 121.298671 0 43.103524 15.757595 83.795799 44.469388 115.43795L140.711536 751.320908c-14.584223 14.584223-22.658582 34.052378-22.658582 54.690835 0 20.641528 8.07436 40.043131 22.59203 54.530084 14.584223 14.647703 33.985826 22.722063 54.757387 22.722063 17.904683 0 34.899131-6.054234 48.636601-17.254515l40.043131 40.043131c14.584223 14.714256 34.049306 22.788616 54.754315 22.788616 20.641528 0 40.043131-8.07436 54.627354-22.658582 15.364423-15.364423 22.852097-35.615851 22.59203-55.830419 0.393172 0.063481 0.71672 0.063481 1.10682 0.06348 20.641528 0 40.043131-8.070264 54.693906-22.654486 14.584223-14.584223 22.658582-33.988897 22.658582-54.627354 0-20.705009-8.07436-40.106612-22.658582-54.723599L432.008959 678.562593l171.365639-171.302158c31.705633 28.778345 72.33545 44.599421 115.371398 44.599421 45.836274 0 88.939799-17.904683 121.428704-50.330107l16.797863-16.861344c66.80135-66.997936 66.737869-175.859472-0.066552-242.597341z" fill="#27323A"/>
    <path d="M821.553298 277.426848l-97.596749-97.663302c-46.03286-45.902827-126.05257-45.836274-172.018878 0.063481l-16.797863 16.734382c-47.399747 47.333195-47.399747 124.552578 0 172.015806l29.688579 29.691651c-0.323548 0.323548-0.780201 0.453581-1.170301 0.780201l-3.54981 3.533428 38.609692 38.609691 3.54981-3.533428c0.323548-0.3901 0.453581-0.846753 0.780201-1.170301l29.688579 29.688579c22.985202 22.981106 53.587086 35.679332 86.009438 35.679332 32.488905 0 63.09079-12.697202 86.07292-35.679332l16.734382-16.797862c47.333195-47.529781 47.333195-124.685683 0-171.952326z" fill="#F4CE73"/>
    <path d="M685.346857 218.373238c-12.630649-12.630649-29.562641-19.664742-47.399747-19.664741-17.971235 0-34.769098 7.034092-47.463228 19.664741l-16.734382 16.797863c-26.175628 26.108052-26.175628 68.688371 0 94.862975l97.596749 97.533268c25.327851 25.392356 69.538196 25.392356 94.862976 0l16.734381-16.734381c26.109076-26.171533 26.109076-68.754923 0-94.862976l-97.596749-97.596749z" fill="#27323A"/>
    <path d="M747.587822 375.481274l-16.73131 16.73131c-2.733774 2.736845-7.227607 4.363799-12.043963 4.363799-4.883933 0-9.377766-1.626954-12.110516-4.363799l-97.596749-97.533268c-4.300318-4.360728-4.950486-9.440223-4.950485-12.107444 0-2.670293 0.650167-7.750812 4.950485-12.048059l16.73131-16.797862c3.32046-3.253908 7.487673-5.013966 12.110516-5.013967s8.791079 1.760059 12.043963 5.013967l97.596749 97.599821c6.643992 6.64092 6.643992 17.514582 0 24.155502z" fill="#FFFFFF"/>
    <path d="M602.984498 436.602109l-38.286144-38.252356c-0.292831 0.260067-0.682932 0.406482-1.040268 0.700337L176.064249 786.673621c-10.677076 10.677076-10.677076 27.931592 0 38.54621 5.340586 5.337514 12.307102 8.006783 19.338122 8.006784 6.96754 0 13.934055-2.670293 19.27157-8.006784l29.688578-29.625098 75.20233 75.232022c5.274033 5.340586 12.240549 8.010879 19.271569 8.010879 6.96754 0 13.934055-2.670293 19.274642-8.010879 10.677076-10.677076 10.677076-27.962308 0-38.639384l39.846545-39.783064c10.610524 10.677076 27.931592 10.613595 38.543139 0 10.677076-10.677076 10.677076-27.931592 0-38.609692L361.300462 678.562593l240.967316-240.903835c0.293855-0.33993 0.453581-0.733102 0.71672-1.056649z" fill="#79CCBF"/>
  </svg>
);

const GameModeCard = memo(({ mode, onClick, searchingCount }: any) => (
  <div
    onClick={onClick}
    className={`relative group cursor-pointer rounded-3xl p-4 h-32 flex flex-col justify-between transition-transform duration-200 active:scale-[0.97] border border-slate-600`}
    style={{ transform: "translateZ(0)" }}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-90 group-hover:opacity-100 transition-opacity rounded-3xl`}
    />
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

    <div className="relative z-10 flex justify-between items-start">
      <div className="p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
        <mode.icon className="w-6 h-6 text-white" />
      </div>
      {mode.isLive && (
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] px-2 py-0.5">CANLI</Badge>
      )}
    </div>

    <div className="relative z-10">
      <h3 className="text-lg font-bold text-white leading-none mb-1 drop-shadow-md">{mode.title}</h3>
      <p className="text-[11px] text-white/80 font-medium line-clamp-1">{mode.description}</p>
      {mode.id === "random-match" && typeof searchingCount === "number" && (
        <div className="mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${searchingCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-[10px] text-white font-medium">{searchingCount} kişi arıyor</span>
        </div>
      )}
    </div>
  </div>
));
GameModeCard.displayName = "GameModeCard";

// --- ANA SAYFA ---

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile, getTotalCredits } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  // 🔥 DÜZELTME: startBackgroundMusic ARTIK YOK. Native otomatik hallediyor.
  // const { startBackgroundMusic } = useMusic(); <-- SİLİNDİ
  const { jokers, loadJokers } = useJokerInventory();
  const searchingPlayersCount = useSearchingPlayersCount();

  usePremiumDailyRewards();

  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);

  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");

  // useMemoryGame taşındı
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);

  const [challengeStatus, setChallengeStatus] = useState<Record<ChallengeType, boolean>>(() => {
    try {
      const cached = sessionStorage.getItem("challengeStatus");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed;
        }
      }
    } catch {}
    return {
      word_hunt: false,
      anagram: false,
      word_chain: false,
      puzzle: false,
      reaktor: false,
      neon_blitz: false,
      memory: false,
    };
  });
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem("wheelSpinsLeft");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed.spins;
        }
      }
    } catch {}
    return null;
  });

  // Fetch daily challenge completion status & wheel spin availability
  useEffect(() => {
    if (!user?.id) return;
    const fetchChallengeStatus = () => {
      sessionStorage.removeItem("challengeStatus");
      getDailyChallengeStatus(user.id).then((status) => {
        const withDate = { ...status, _date: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) };
        sessionStorage.setItem("challengeStatus", JSON.stringify(withDate));
        setChallengeStatus(status);
      });
    };
    fetchChallengeStatus();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchChallengeStatus();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Check wheel spins
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data: spinData }) => {
        const dailyAvailable = !spinData ? 1 : 0;
        const bonus = profile?.bonus_spins || 0;
        const total = dailyAvailable + bonus;
        setWheelSpinsLeft(total);
        sessionStorage.setItem("wheelSpinsLeft", JSON.stringify({ spins: total, _date: today }));
      });

    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user?.id, profile?.bonus_spins]);

  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  const vipType = getVipType(profile);

  // --- HESAPLAMALAR ---
  const calculateLevel = (totalScore: number) => {
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = 1000;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = level * 1000;
    }
    return { level, experience: totalScore - totalExpNeeded, nextLevelExp: currentLevelExp };
  };

  const levelData = calculateLevel(profile?.total_score || 0);
  const progressPercent = (levelData.experience / levelData.nextLevelExp) * 100;

  const calculateUnlimitedTimeLeft = () => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }
    const now = new Date();
    const expiryDateString = (profile as any).unlimited_lives_until;
    if (!expiryDateString) return;

    const expiry = new Date(expiryDateString);
    if (now >= expiry) {
      setUnlimitedTimeLeft("");
      refreshProfile();
      return;
    }

    const timeDiff = expiry.getTime() - now.getTime();
    const totalSeconds = Math.floor(timeDiff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) setUnlimitedTimeLeft(`${days} Gün ${hours} Sa`);
    else {
      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      const s = seconds.toString().padStart(2, "0");
      setUnlimitedTimeLeft(`${h}:${m}:${s}`);
    }
  };

  const calculatePremiumTimeLeft = () => {
    if (!profile?.premium_until) return setPremiumTimeLeft("");
    const now = new Date();
    const expiry = new Date(profile.premium_until);
    if (now >= expiry) return setPremiumTimeLeft("");

    const timeDiff = expiry.getTime() - now.getTime();
    // 🔧 FIX: Tutarlı hesaplama - kalan tam günleri göster
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Eğer 1+ gün kaldıysa, gün ve saat olarak göster
    if (days > 0) {
      if (remainingHours > 0) {
        setPremiumTimeLeft(`${days} Gün ${remainingHours}s`);
      } else {
        setPremiumTimeLeft(`${days} Gün`);
      }
    } else {
      // Son gün - saat ve dakika göster
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      setPremiumTimeLeft(`${remainingHours}s ${minutes}d`);
    }
  };

  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }
    const now = new Date();
    const lastRefresh = new Date(profile.last_credit_refresh);
    const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);
    if (now >= nextRefresh) return setTimeUntilNextCredit("");
    const timeDiff = nextRefresh.getTime() - now.getTime();
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    setTimeUntilNextCredit(`${minutes}:${seconds.toString().padStart(2, "0")}`);
  };

  const refreshCredits = async () => {
    if (!user || isPremium) return;
    const currentCredits = profile?.game_credits || 0;
    if (currentCredits >= 5) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: Math.min(currentCredits + 1, 5),
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (!error) {
        await refreshProfile();
        toast.success(`🎮 +1 Kredi eklendi!`);
        playSound("buttonClick");
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (profile && isUnlimitedLivesActive(profile)) {
      calculateUnlimitedTimeLeft();
      const interval = setInterval(calculateUnlimitedTimeLeft, 1000);
      return () => clearInterval(interval);
    } else setUnlimitedTimeLeft("");
  }, [profile]);

  useEffect(() => {
    if (profile?.premium_until) {
      calculatePremiumTimeLeft();
      const interval = setInterval(calculatePremiumTimeLeft, 60000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const nextRefresh = new Date(new Date(profile.last_credit_refresh).getTime() + 72 * 60 * 1000);
          if (now >= nextRefresh) {
            refreshCredits();
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  // 🔥 DÜZELTME: Bu useEffect ARTIK GEREKSİZ. SİLİNDİ.
  /*
  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);
  */

  useEffect(() => {
    const checkDailyReset = async () => {
      if (!user || !profile) return;
      const today = new Date().toISOString().split("T")[0];
      const lastReset = profile.last_daily_reset
        ? new Date(profile.last_daily_reset).toISOString().split("T")[0]
        : null;
      if (lastReset !== today) await refreshProfile();
    };
    checkDailyReset();
  }, [user, profile?.last_daily_reset]);

  useEffect(() => {
    console.log("🏠 [HomePage] Mount - ilk veri yüklemesi...");
    refreshProfile(true);
    // loadJokers() kaldırıldı - useJokerInventory hook'u zaten mount'ta çağırıyor
  }, []);

  const handleGameModeClick = useCallback(
    (modeId: string) => {
      playSound("buttonClick");
      if (
        !isPremium &&
        (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0 &&
        !isUnlimitedLivesActive(profile)
      ) {
        toast.error("Oyun için yeterli sayfan yok!", { description: "Oyun oynamak için sayfa satın alın." });
        navigate("/market");
        return;
      }
      if (modeId === "tournament") navigate("/tournament");
      else setSelectedMode(modeId);
    },
    [playSound, isPremium, profile?.game_credits, profile?.bonus_credits, profile?.unlimited_lives_until, navigate],
  );

  const handleMatchFound = (roomId: string) => {
    setShowMatchmaking(false);
    if (roomId === "ai-game") navigate(`/game/vs-computer?type=${matchmakingGameType}`);
    else navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  // --- CONFIG ---
  const gameModesConfig = useMemo(
    () => [
      {
        id: "random-match",
        title: "Rastgele Rakip",
        description: "Hızlı eşleşme",
        icon: RastgeleIcon,
        gradient: "from-violet-500 via-purple-500 to-indigo-500",
        glowColor: "violet",
        isLive: true,
      },
      {
        id: "tournament",
        title: "Turnuva",
        description: "Büyük ödüller",
        icon: TurnuvaIcon,
        gradient: "from-amber-400 via-orange-500 to-red-500",
        glowColor: "amber",
        isLive: false,
      },
      {
        id: "vs-computer",
        title: "Yapay Zeka",
        description: "Pratik yap",
        icon: AiModIcon,
        gradient: "from-cyan-400 via-sky-500 to-blue-500",
        glowColor: "cyan",
        isLive: false,
      },
      {
        id: "private-room",
        title: "Özel Oda",
        description: "Arkadaşınla oyna",
        icon: OzelOdaIcon,
        gradient: "from-emerald-400 via-green-500 to-teal-500",
        glowColor: "emerald",
        isLive: false,
      },
    ],
    [],
  );

  // miniGamesConfig artık MiniGamesPage'e taşındı

  const totalCredits = getTotalCredits();

  // Seviyeye göre arka plan rengi (çift tonlu gradient)
  const getLevelBackgroundColor = () => {
    return {
      bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", // index.html renkleri
      gradient: "from-[#ff6b6b]/40", // Şeffaflığı %20'den %40'a çıkardık
      headerBg: "#1a1a2e",
    };

    /*
    const level = levelData.level;

    if (level >= 70) 
      return { bg: "linear-gradient(135deg, #CFD8DC 0%, #B0BEC5 100%)", gradient: "from-slate-300/60", headerBg: "#C0CCD3" }; 
    if (level >= 40) 
      return { bg: "linear-gradient(135deg, #BFDBFE 0%, #93C5FD 100%)", gradient: "from-blue-300/60", headerBg: "#A9D0FE" }; 
    if (level >= 25) 
      return { bg: "linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%)", gradient: "from-emerald-300/60", headerBg: "#A0F3BE" }; 
    if (level >= 10) 
      return { bg: "linear-gradient(135deg, #E9D5FF 0%, #D8B4FE 100%)", gradient: "from-purple-300/60", headerBg: "#E0C5FE" }; 
    return { bg: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)", gradient: "from-orange-200/50", headerBg: "#FEEDA6" };
    */
  };

  const levelBgColors = getLevelBackgroundColor();

  return (
    <>
      <LeaderboardPrizeDialog />
      <ChallengePrizeDialog />
      <div
        className="fixed inset-0 flex flex-col text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500"
        style={{ background: levelBgColors.bg || "#1a1a2e" }}
      >
        {/* Light Effects */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${levelBgColors.gradient} via-transparent to-transparent pointer-events-none transition-all duration-500 opacity-30`}
        />

        {/* --------------------------------------------------------
        SABİT ÜST ALAN (FIXED HEADER AREA) 
      -------------------------------------------------------- */}
        <div
          className="flex-none z-30 pb-4 relative border-b border-white/5"
          style={{ backgroundColor: levelBgColors.headerBg || "transparent" }}
        >
          {/* HEADER (Profil & Mürekkep) */}
          <div className="px-5 pt-6 pb-2 flex items-center justify-between">
            {/* Profil */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAvatarView(true)}>
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full p-[2px] ${vipType ? "bg-gradient-to-tr from-amber-300 to-orange-500" : "bg-gradient-to-tr from-indigo-400 to-purple-500"}`}
                >
                  <Avatar className="w-full h-full border-2 border-[#1a1a2e]">
                    <AvatarImage
                      src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">U</AvatarFallback>
                  </Avatar>
                </div>
                {isPremium && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-[#1a1a2e]">
                    <VipCrownIcon className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight text-white drop-shadow-md">
                  {profile?.username || "Misafir"}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{greeting}</p>
              </div>
            </div>

            {/* Mürekkep */}
            <div
              onClick={() => {
                playSound("buttonClick");
                navigate("/market");
              }}
              className="flex items-center gap-2 bg-[#1e2d45] border border-indigo-500/20 rounded-full pl-1 pr-4 py-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                <img src="/murekkepikon.png" alt="ink" className="w-7 h-7 object-contain brightness-110" />
              </div>
              <span className="text-base font-bold text-white">{profile?.ink_count || 0}</span>
              <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center ml-1">
                <span className="text-xs leading-none text-white font-bold">+</span>
              </div>
            </div>
          </div>

          {/* --- LEVEL VE XP KARTI --- */}
          <div className="px-5 mt-2">
            {(() => {
              const level = levelData.level;
              let starGradient = "from-amber-400 to-orange-500";
              let shadowColor = "shadow-orange-500/20";

              if (level >= 70) {
                starGradient = "from-slate-400 to-slate-600";
                shadowColor = "shadow-slate-500/20";
              } else if (level >= 40) {
                starGradient = "from-blue-400 to-blue-600";
                shadowColor = "shadow-blue-500/20";
              } else if (level >= 25) {
                starGradient = "from-emerald-400 to-green-600";
                shadowColor = "shadow-green-500/20";
              } else if (level >= 10) {
                starGradient = "from-purple-500 to-indigo-600";
                shadowColor = "shadow-purple-500/20";
              }

              return (
                <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${starGradient} flex items-center justify-center`}
                    >
                      <Star className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Seviye {level}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {levelData.experience}/{levelData.nextLevelExp} XP
                        </span>
                      </div>
                      <div className="h-2 w-32 bg-slate-800 rounded-full mt-2 overflow-hidden border border-white/5">
                        <div
                          className={`h-full bg-gradient-to-r ${starGradient} transition-all duration-1000`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-[0.1em] mb-1">Puan</span>
                    <span className="text-sm font-mono font-bold text-red-500">
                      {(profile?.total_score || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* --- JOKERLER --- */}
          <div className="px-5 mt-3">
            <div className="bg-[#1e2d45] rounded-2xl p-3 border border-indigo-500/20 flex justify-around">
              {[
                { img: "/degistirIkon.png", count: jokers.degistir, name: "Değiştir" },
                { img: "/fisildaIkon.png", count: jokers.fisilida, name: "Fısılda" },
                { img: "/senyazIkon.png", count: jokers.senYaz, name: "Sen Yaz" },
              ].map((j, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 flex-1 active:scale-90 transition-transform cursor-pointer group"
                  onClick={() => navigate("/market")}
                >
                  <img
                    src={j.img}
                    className="w-9 h-9 object-contain drop-shadow-lg group-hover:brightness-125 transition-all"
                    alt={j.name}
                  />
                  <span className="text-[10px] font-bold text-slate-400">x{j.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* INFO PANELS (SÜRE & HAK) */}
          <div className="px-5 mt-2 space-y-2">
            {isPremium && premiumTimeLeft && (
              <div
                className={`flex items-center justify-between rounded-xl p-3 px-4 border-2 ${
                  vipType === "yearly"
                    ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 border-amber-600"
                    : vipType === "monthly"
                      ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 border-blue-600"
                      : "bg-gradient-to-r from-amber-50 to-orange-50 border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-full ${
                      vipType === "yearly" || vipType === "monthly" ? "bg-white/30" : "bg-amber-100"
                    }`}
                  >
                    <VipCrownIcon
                      className={`w-5 h-5 ${
                        vipType === "yearly" || vipType === "monthly" ? "" : ""
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-bold ${
                        vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-800"
                      }`}
                    >
                      {vipType === "yearly"
                        ? "⭐ VIP Yazar (Yıllık)"
                        : vipType === "monthly"
                          ? "💎 VIP Yazar (Aylık)"
                          : "VIP Yazar"}
                    </span>
                    <span
                      className={`text-[10px] ${
                        vipType === "yearly" || vipType === "monthly" ? "text-white/80" : "text-amber-600"
                      }`}
                    >
                      Sınırsız hak • Günlük joker • 2x XP
                    </span>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded-lg ${
                    vipType === "yearly" || vipType === "monthly" ? "bg-white/20" : "bg-amber-100"
                  }`}
                >
                  <span
                    className={`text-xs font-mono font-bold ${
                      vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-600"
                    }`}
                  >
                    {premiumTimeLeft}
                  </span>
                </div>
              </div>
            )}

            {(!isPremium || isUnlimitedLivesActive(profile)) && (
              <div
                className={`flex items-center justify-between backdrop-blur-md border rounded-xl p-2 px-3 ${
                  isUnlimitedLivesActive(profile)
                    ? getUnlimitedType(profile) === "maraton"
                      ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
                      : "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30"
                    : "bg-[#1e2d45] border-indigo-500/20"
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isUnlimitedLivesActive(profile)
                      ? getUnlimitedType(profile) === "maraton"
                        ? "text-amber-400"
                        : "text-blue-400"
                      : "text-slate-500"
                  }`}
                >
                  {isUnlimitedLivesActive(profile) ? (
                    <span className="flex items-center gap-1.5">
                      <UnlimitedIcon className="w-12 h-12 flex-shrink-0 -my-2" />
                      {getUnlimitedType(profile) === "maraton" ? "Maraton Modu" : "Sınırsız Akış"}
                    </span>
                  ) : (
                    "Kalan Sayfalarım"
                  )}
                </span>

                {isUnlimitedLivesActive(profile) ? (
                  <div className="flex items-center gap-2">
                    {unlimitedTimeLeft ? (
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${
                          getUnlimitedType(profile) === "maraton"
                            ? "bg-amber-500/20 border-amber-500/30"
                            : "bg-blue-500/20 border-blue-500/30"
                        }`}
                      >
                        <Clock
                          className={`w-3 h-3 animate-pulse ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-400" : "text-blue-400"
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-bold tabular-nums ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-300" : "text-blue-300"
                          }`}
                        >
                          {unlimitedTimeLeft}
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-5 bg-slate-700 rounded animate-pulse" />
                    )}
                    <Badge
                      className={`text-[10px] px-2 py-0.5 border ${
                        getUnlimitedType(profile) === "maraton"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}
                    >
                      Sınırsız
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {totalCredits > 5 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 opacity-50">
                          {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="w-6 h-2 rounded-sm bg-green-500 skew-x-[-10deg]" />
                          ))}
                        </div>
                        <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs px-2 py-0.5 shadow-sm">
                          + {totalCredits - 5} Sayfa
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-6 h-2 rounded-sm skew-x-[-10deg] transition-all duration-300 ${i < totalCredits ? "bg-green-500" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                    )}

                    {timeUntilNextCredit && totalCredits < 5 && (
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1 rounded">
                        {timeUntilNextCredit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* HEDİYE BANNER */}
          {isPremium && isGiftPremium(profile) && (
            <div className="px-5 mt-4">
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md z-10">
                  <Gift className="w-5 h-5 text-white animate-bounce" />
                </div>
                <div className="flex-1 z-10">
                  <h3 className="text-sm font-bold text-white">Hediye Premium!</h3>
                  <p className="text-[10px] text-white/90">
                    Kalan: {new Date(profile.premium_until).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------
        KAYDIRILABİLİR ALAN (SCROLLABLE CONTENT) 
      -------------------------------------------------------- */}
        <div className="flex-1 flex flex-col overflow-y-auto relative z-10 pb-28">
          {/* OYUN MODLARI */}
          <div className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Oyun Modları</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {gameModesConfig.map((mode) => (
                <GameModeCard key={mode.id} mode={mode} onClick={() => handleGameModeClick(mode.id)} searchingCount={searchingPlayersCount} />
              ))}
            </div>
          </div>

          {/* GÜNLÜK CHALLENGE'LAR */}
          <div className="mt-6 pl-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Düello & Görev</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 pr-5 scrollbar-hide">
              {/* Kelime Puzzle */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/puzzle");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.puzzle ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.puzzle ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  1
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.puzzle ? <Check className="w-6 h-6 text-amber-300" /> : "🧩"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.puzzle ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.puzzle ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Kelime Puzzle</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.puzzle ? "Yarın tekrar gel!" : "Harfleri sıraya diz"}
                  </p>
                </div>
              </div>

              {/* Reaktör */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/reaktor");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.reaktor ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.reaktor ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  2
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.reaktor ? <Check className="w-6 h-6 text-amber-300" /> : "☢️"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.reaktor ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.reaktor ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Reaktör Koşusu</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.reaktor ? "Yarın tekrar gel!" : "Koş ve harfleri topla"}
                  </p>
                </div>
              </div>

              {/* Refleks (Neon Blitz) */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/neon-blitz");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.neon_blitz ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.neon_blitz ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  3
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.neon_blitz ? <Check className="w-6 h-6 text-amber-300" /> : "⚡"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.neon_blitz ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.neon_blitz ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Refleks</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.neon_blitz ? "Yarın tekrar gel!" : "Hızını test et"}
                  </p>
                </div>
              </div>

              {/* Hafıza Oyunu */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/memory");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.memory ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.memory ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  4
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.memory ? <Check className="w-6 h-6 text-amber-300" /> : "🧠"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.memory ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.memory ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Kelime Hafıza</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.memory ? "Yarın tekrar gel!" : "Kelimeleri eşleştir"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* GÜNLÜK ÇARK */}
          <div className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-red-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Şans Çarkı</h3>
            </div>
            <div
              onClick={() => {
                playSound("buttonClick");
                navigate("/wheel");
              }}
              className={`w-full rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform border ${
                wheelSpinsLeft === 0 ? "border-red-400/40 opacity-70" : "border-red-500/30"
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 ${
                  wheelSpinsLeft === 0 ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"
                } transition-opacity rounded-2xl`}
              />
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                {wheelSpinsLeft === 0 ? <Check className="w-6 h-6 text-red-300" /> : <WheelIcon className="w-10 h-10" />}
              </div>
              <div className="relative z-10 flex-1">
                <h3 className="text-base font-bold text-white leading-none mb-1 drop-shadow-md">
                  {wheelSpinsLeft === 0 ? "Çark Çevrildi" : "Şansını Dene!"}
                </h3>
                <p className="text-[10px] text-white/70 font-medium">
                  {wheelSpinsLeft === 0 ? "Yarın tekrar gel!" : "Çarkı çevir, ödüller kazan!"}
                </p>
              </div>
              {wheelSpinsLeft !== null && wheelSpinsLeft > 0 && (
                <Badge className="relative z-10 text-[9px] px-2 py-0.5 bg-white/20 text-white border-white/30">
                  x{wheelSpinsLeft} hak
                </Badge>
              )}
            </div>
          </div>

          {/* İSTATİSTİKLER */}
          <div className="px-5 mt-6 pb-12">
            {" "}
            {/* Alt boşluğu biraz artırdım, menüye girmesin */}
            <div className="grid grid-cols-3 gap-3">
              <StatWidget
                icon={Target}
                value={profile?.daily_games || 0}
                label="Oyun"
                colorClass="rose"
                // !bg-[#16213e] kullanarak içindeki beyazı zorla eziyoruz
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
              <StatWidget
                icon={Flame}
                value={profile?.win_streak || 0}
                label="Seri"
                colorClass="orange"
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
              <StatWidget
                icon={Trophy}
                value={profile?.wins || 0}
                label="Zafer"
                colorClass="amber"
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
            </div>
          </div>
        </div>

        {/* --- MODALLAR --- */}
        {selectedMode && selectedMode === "private-room" ? (
          <PrivateRoomModal
            onClose={() => setSelectedMode(null)}
            onStartGame={(matchId, type) => {
              setSelectedMode(null);
              navigate(`/game/random-match?room=${matchId}&type=${type}`);
            }}
          />
        ) : selectedMode ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(type) => {
              if (selectedMode === "tournament") navigate("/tournament", { state: { gameType: type } });
              else if (selectedMode === "random-match") {
                setMatchmakingGameType(type);
                setMatchmakingKey(Date.now());
                setShowMatchmaking(true);
                setTimeout(() => startSearch(type), 100);
              } else navigate(`/game/${selectedMode}?type=${type}`);
              setSelectedMode(null);
            }}
            onClose={() => setSelectedMode(null)}
          />
        ) : null}

        {showMatchmaking && (
          <div className="fixed inset-0 z-[9999] bg-[#1a1a2e]">
            {" "}
            {/* Flashbang etkisini önlemek için koyu arka plan */}
            <SlotMatchmaking
              key={`matchmaking-${matchmakingKey}`}
              onCancel={() => {
                cancelSearch();
                setShowMatchmaking(false);
              }}
              searchProgress={searchProgress}
            />
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-50">
          <FloatingMenu />
        </div>

        <AvatarViewDialog
          open={showAvatarView}
          onOpenChange={setShowAvatarView}
          avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
          username={profile?.username || "Oyuncu"}
        />
      </div>
    </>
  );
};

export default HomePage;
