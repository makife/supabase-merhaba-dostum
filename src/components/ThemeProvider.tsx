import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

interface ThemeContextType {
  theme: string;
  avatarFrame: string;
  soundPack: string;
  applyTheme: (theme: string) => void;
  applyAvatarFrame: (frame: string) => void;
  applySoundPack: (pack: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { hasPurchased } = useUserPurchases();
  const { isPremium } = useUser();
  const [theme, setTheme] = useState('default');
  const [avatarFrame, setAvatarFrame] = useState('none');
  const [soundPack, setSoundPack] = useState('default');

  // Kullanıcı ayarlarını yükle
  const loadUserSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setTheme(data.active_theme || 'default');
        setAvatarFrame(data.active_avatar_frame || 'none');
        setSoundPack(data.active_sound_pack || 'default');
        
        // Temayı DOM'a uygula
        applyThemeToDOM(data.active_theme || 'default');
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  // Temayı DOM'a uygula
  const applyThemeToDOM = (themeName: string) => {
    const root = document.documentElement;
    
    // Mevcut tema sınıflarını temizle
    root.classList.remove('theme-dark-ocean', 'theme-sunset', 'theme-forest', 'theme-classic', 'dark');
    
    // Yeni temayı uygula
    if (themeName === 'dark') {
      root.classList.add('dark');
      console.log('Karanlık tema uygulandı');
    } else if (themeName !== 'default') {
      // Tema ID'sini direkt kullan (dark_ocean -> theme-dark-ocean)
      const themeClass = `theme-${themeName.replace(/_/g, '-')}`;
      root.classList.add(themeClass);
      console.log(`Tema uygulandı: ${themeClass}`);
    } else {
      console.log('Varsayılan tema uygulandı');
    }
  };

  // Tema değiştir
  const applyTheme = async (newTheme: string) => {
    if (!user) return false;

    // Premium üyeler tüm temalara erişebilir
    const premiumThemes = ['dark_ocean', 'sunset', 'forest'];
    const creditsThemes = ['classic'];
    
    if (premiumThemes.includes(newTheme)) {
      const requiredPurchase = `theme_${newTheme}`;
      if (!isPremium && !hasPurchased(requiredPurchase)) {
        return false;
      }
    }
    
    if (creditsThemes.includes(newTheme)) {
      const requiredPurchase = 'credits_theme_basic';
      if (!isPremium && !hasPurchased(requiredPurchase)) {
        return false;
      }
    }

    try {
      await updateUserSetting('active_theme', newTheme);
      setTheme(newTheme);
      applyThemeToDOM(newTheme);
      return true;
    } catch (error) {
      console.error('Error applying theme:', error);
      return false;
    }
  };

  // Avatar çerçevesi değiştir
  const applyAvatarFrame = async (newFrame: string) => {
    if (!user) return true;

    // Premium üyeler tüm çerçevelere erişebilir (none hariç)
    const frameRequiresPurchase = newFrame !== 'none';
    
    if (frameRequiresPurchase && !isPremium && !hasPurchased(newFrame)) {
      return false;
    }

    try {
      await updateUserSetting('active_avatar_frame', newFrame);
      setAvatarFrame(newFrame);
      return true;
    } catch (error) {
      console.error('Error applying avatar frame:', error);
      return false;
    }
  };

  // Ses paketi değiştir
  const applySoundPack = async (newPack: string) => {
    if (!user) return false;

    // Premium üyeler tüm ses paketlerine erişebilir
    const premiumSoundPacks = ['space', 'nature'];
    
    if (premiumSoundPacks.includes(newPack)) {
      const requiredPurchase = `sound_pack_${newPack}`;
      if (!isPremium && !hasPurchased(requiredPurchase)) {
        return false;
      }
    }

    try {
      await updateUserSetting('active_sound_pack', newPack);
      setSoundPack(newPack);
      return true;
    } catch (error) {
      console.error('Error applying sound pack:', error);
      return false;
    }
  };

  // Kullanıcı ayarını güncelle
  const updateUserSetting = async (field: string, value: string) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ [field]: value })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            [field]: value
          });
      }
    } catch (error) {
      console.error('Error updating user setting:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserSettings();
    } else {
      // Kullanıcı çıkış yaptığında varsayılan temaya dön
      setTheme('default');
      setAvatarFrame('none');
      setSoundPack('default');
      applyThemeToDOM('default');
    }
  }, [user]);

  return (
    <ThemeContext.Provider value={{
      theme,
      avatarFrame,
      soundPack,
      applyTheme,
      applyAvatarFrame,
      applySoundPack
    }}>
      {children}
    </ThemeContext.Provider>
  );
};