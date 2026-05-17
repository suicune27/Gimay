import { useState, useCallback } from 'react';
import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { toast } from 'sonner';
import { useStore } from '../store/useStore';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const { setProfile } = useStore();

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const res = await SupabaseAuthService.signIn(email, password);
    
    if (res.success) {
      toast.success('Welcome back, operator.', {
        description: 'Authentication link established.'
      });
    } else {
      toast.error(res.error?.type === 'invalid_credentials' ? 'Invalid Credentials' : 'Login Failed', {
        description: res.error?.message
      });
    }
    setLoading(false);
    return res.success;
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    const res = await SupabaseAuthService.signUp(email, password, fullName);
    
    if (res.success) {
      toast.success('Account Created Successfully', {
        description: 'Please check your email for confirmation.',
        duration: 10000,
      });
    } else {
      // Map specific errors to titles
      let title = 'Registration Failed';
      if (res.error?.type === 'user_exists') title = 'Email Already Registered';
      if (res.error?.type === 'weak_password') title = 'Weak Password';

      toast.error(title, {
        description: res.error?.message
      });
    }
    setLoading(false);
    return res.success;
  }, []);

  const logout = useCallback(async () => {
    const res = await SupabaseAuthService.signOut();
    if (res.success) {
      toast.info('Session Terminated', {
        description: 'Secure connection closed.'
      });
      setProfile(null);
    }
    return res.success;
  }, [setProfile]);

  return {
    loading,
    login,
    signup,
    logout
  };
};
