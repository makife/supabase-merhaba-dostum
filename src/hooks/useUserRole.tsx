import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'moderator' | 'user' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  
  // 🔥 Subscription guard - aynı user için tekrar oluşturma
  const subscriptionUserIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }

    // 🔥 GUARD: Aynı user için zaten subscription varsa atla
    if (subscriptionUserIdRef.current === user.id && channelRef.current) {
      console.log("[useUserRole] ⏭️ Subscription zaten aktif, atlanıyor...");
      return;
    }

    console.log("[useUserRole] 🔌 Yeni subscription oluşturuluyor:", user.id.slice(-8));
    subscriptionUserIdRef.current = user.id;

    const fetchUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('user');
        } else {
          setRole(data?.role || 'user');
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    // Real-time subscription for role changes
    const channel = supabase
      .channel('user_role_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Role changed:', payload);
          if (payload.eventType === 'DELETE') {
            setRole('user');
          } else if (payload.new && 'role' in payload.new) {
            setRole(payload.new.role as UserRole);
          }
        }
      )
      .subscribe();
    
    channelRef.current = channel;
    
    // 🔥 Session recovered event listener - foreground'dan dönünce rolü yenile
    const handleSessionRecovered = () => {
      console.log("[useUserRole] 🔐 Session recovered - rol yeniden yükleniyor...");
      fetchUserRole();
    };
    
    const handleForeground = () => {
      console.log("[useUserRole] ☀️ App foreground - rol kontrol ediliyor...");
      setTimeout(() => fetchUserRole(), 300);
    };
    
    window.addEventListener('session-recovered', handleSessionRecovered);
    window.addEventListener('appForeground', handleForeground);

    // Cleanup - channel'ı koruyoruz
    return () => {
      console.log("[useUserRole] Cleanup - channel korunuyor");
      window.removeEventListener('session-recovered', handleSessionRecovered);
      window.removeEventListener('appForeground', handleForeground);
    };
  }, [user?.id]);

  const isModerator = role === 'moderator' || role === 'admin';
  const isAdmin = role === 'admin';

  return {
    role,
    loading,
    isModerator,
    isAdmin
  };
}
