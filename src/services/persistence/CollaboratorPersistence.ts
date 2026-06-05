import { supabase, globalSupabase } from '../../lib/supabase';
import { isOffline } from './CorePersistence';

export async function inviteCollectionCollaborator(collectionId: string, identifier: string, role: 'viewer' | 'editor' | 'admin', invitedBy: string) {
  if (isOffline()) throw new Error('Collaborator operations require a network connection.');
  const { data: profile, error: profileError } = await globalSupabase
    .from('profiles').select('id, email, username, full_name')
    .or(`email.eq.${identifier},username.eq.${identifier},full_name.eq.${identifier}`).limit(1).maybeSingle();
  if (profileError || !profile) throw new Error('No registered user found for that email or username.');

  const { data, error } = await supabase
    .from('collection_collaborators').upsert({
      collection_id: collectionId, user_id: profile.id, invited_by: invitedBy, role, updated_at: new Date().toISOString()
    }, { onConflict: 'collection_id,user_id' }).select('*, profiles(email, full_name, username)').single();
  if (error) throw error;
  return data;
}

export async function updateCollectionCollaboratorRole(collectionId: string, userId: string, role: 'viewer' | 'editor' | 'admin') {
  if (isOffline()) throw new Error('Collaborator operations require a network connection.');
  const { data, error } = await supabase
    .from('collection_collaborators').update({ role, updated_at: new Date().toISOString() })
    .match({ collection_id: collectionId, user_id: userId }).select('*, profiles(email, full_name, username)').single();
  if (error) throw error;
  return data;
}

export async function removeCollectionCollaborator(collectionId: string, userId: string) {
  if (isOffline()) throw new Error('Collaborator operations require a network connection.');
  const { error } = await supabase.from('collection_collaborators').delete().match({ collection_id: collectionId, user_id: userId });
  if (error) throw error;
}
