import { supabase } from '../lib/supabase';
import { AuthErrorHandler, AuthErrorResponse } from '../utils/AuthErrorHandler';

export interface AuthResponse {
  success: boolean;
  error?: AuthErrorResponse;
  data?: any;
}

export class SupabaseAuthService {
  /**
   * UX Layer Pre-check: Check if a profile exists for this email.
   * Note: This only checks public.profiles, not auth.users.
   */
  static async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      return !!data;
    } catch (e) {
      return false;
    }
  }

  static async signUp(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    try {
      // 1. Optional UX Pre-check
      const exists = await this.checkEmailExists(email);
      if (exists) {
        return {
          success: false,
          error: {
            type: 'user_exists',
            message: 'This email is already registered. Please log in instead.'
          }
        };
      }

      // 2. Proceed with Supabase Auth SignUp
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
          }
        }
      });

      if (error) {
        return { success: false, error: AuthErrorHandler.handle(error) };
      }

      // 3. Handle the "silent" already registered case (identities is empty)
      const identities = data?.user?.identities;
      if (data?.user && Array.isArray(identities) && identities.length === 0) {
        return {
          success: false,
          error: {
            type: 'user_exists',
            message: 'This email is already registered. Please log in instead.'
          }
        };
      }

      return { success: true, data };
    } catch (e) {
      return { 
        success: false, 
        error: { type: 'network_error', message: 'Connection failed. Please check your network.' } 
      };
    }
  }

  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: AuthErrorHandler.handle(error) };
      }
      
      return { success: true, data };
    } catch (e) {
      return { 
        success: false, 
        error: { type: 'network_error', message: 'Connection failed. Please check your network.' } 
      };
    }
  }

  static async signOut(): Promise<AuthResponse> {
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: AuthErrorHandler.handle(error) };
    return { success: true };
  }

  static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
}
