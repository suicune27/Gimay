import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

export function usePresence() {
  const { profile, activeTabId, setMemberPresence } = useStore();

  useEffect(() => {
    if (!profile?.id) return;

    // Presence channel for the entire app to track who is where
    const channel = supabase.channel('presence-global', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const formatted: Record<string, any> = {};
        
        Object.keys(state).forEach(key => {
          const presences = state[key] as any[];
          if (presences.length > 0) {
            formatted[key] = presences[0];
          }
        });
        
        setMemberPresence(formatted);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Leave:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: profile.id,
            name: profile.full_name || profile.email,
            activeTabId: activeTabId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.id, activeTabId]);

  // Collection-specific presence for shared collections
  useEffect(() => {
    if (!profile?.id) return;

    const channels: any[] = [];

    // Track presence for each shared collection
    // (Simplified version: we'll just use the global one for now but filter by workspace/collection in UI)
    
    return () => {
      channels.forEach(ch => ch.unsubscribe());
    };
  }, [profile?.id]);
}
