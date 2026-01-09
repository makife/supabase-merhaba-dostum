import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from "@capacitor/core";
import { registerForegroundCleanup, subscribeToRecoveryComplete } from "@/utils/foregroundOrchestrator";

type UserRole = 'admin' | 'moderator' | 'user' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  
  // Refs
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const fetchUserRole = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (error) {
        console.error('Error fetching user role:', error);
        setRole('user');
      } else {
        setRole(data?.role || 'user');
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      if (isMountedRef.current) {
        setRole('user');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  // 🔥 Subscription'ı kapat
  const closeSubscription = useCallback(() => {
    console.log("[useUserRole] 🧹 Subscription kapatılıyor...");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // 🔥 Subscription'ı aç
  const openSubscription = useCallback(() => {
    if (!user?.id || channelRef.current) return;

    console.log("[useUserRole] 🔌 Subscription açılıyor:", user.id.slice(-8));

    const channel = supabase
      .channel(`user_role_changes_${user.id}_${Date.now()}`)
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
          if (!isMountedRef.current) return;
          
          if (payload.eventType === 'DELETE') {
            setRole('user');
          } else if (payload.new && 'role' in payload.new) {
            setRole(payload.new.role as UserRole);
          }
        }
      )
      .subscribe();
    
    channelRef.current = channel;
  }, [user?.id]);

  // Ana effect
  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }

    // İlk yükleme
    fetchUserRole();

    // Native platformda orchestrator'a kayıt ol
    if (Capacitor.isNativePlatform()) {
      const unregisterCleanup = registerForegroundCleanup(closeSubscription);
      
      const unsubscribeRecovery = subscribeToRecoveryComplete(() => {
        console.log("[useUserRole] 🔄 Recovery complete - subscription yeniden açılıyor");
        openSubscription();
        fetchUserRole();
      });

      openSubscription();

      return () => {
        isMountedRef.current = false;
        unregisterCleanup();
        unsubscribeRecovery();
        closeSubscription();
      };
    } else {
      // Web platformda normal davranış
      openSubscription();

      return () => {
        isMountedRef.current = false;
        closeSubscription();
      };
    }
  }, [user?.id, fetchUserRole, openSubscription, closeSubscription]);

  const isModerator = role === 'moderator' || role === 'admin';
  const isAdmin = role === 'admin';

  return {
    role,
    loading,
    isModerator,
    isAdmin
  };
}
