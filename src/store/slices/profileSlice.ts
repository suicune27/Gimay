import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { Profile, Collection } from '../../types';
import { syncManager } from '../../services/SyncService';

export interface ProfileSlice {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  canPerformAction: (collection: Collection, action: 'view' | 'edit' | 'execute') => boolean;
}

export const createProfileSlice: StateCreator<AppState, [], [], ProfileSlice> = (set, get) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),

  updateProfile: async (data) => {
    const profile = get().profile;
    if (!profile) return;
    const newProfile = { ...profile, ...data };
    set({ profile: newProfile });
    syncManager.enqueue('profile', profile.id, data.preferences || data);
  },

  canPerformAction: (collection: Collection, action) => {
    const state = get();
    const profile = state.profile;
    if (!profile || !collection) return false;

    const isOwner = collection.user_id === profile.id ||
      (collection as any).owner_email === profile.email;
    if (isOwner) return true;

    const directRole = collection.collaborators?.find(c => c.user_id === profile.id)?.role;
    if (directRole) {
      if (directRole === 'admin') return true;
      if (directRole === 'editor') return true;
      if (directRole === 'viewer') return action === 'view';
    }

    if (collection.visibility !== 'team' && !directRole) return false;

    const team = state.teams.find(t => t.id === collection.team_id);
    const teamMember = team?.team_members?.find(m => m.user_id === profile.id);

    if (teamMember) {
      if (teamMember.role === 'admin' || teamMember.role === 'editor') return true;
      if (action === 'view') return true;
      if (action === 'execute') return collection.permission === 'execute' || collection.permission === 'edit';
      if (action === 'edit') return collection.permission === 'edit';
    }

    return false;
  },
});
