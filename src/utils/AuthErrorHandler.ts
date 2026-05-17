export type AuthErrorType = 
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'network_error'
  | 'unknown';

export interface AuthErrorResponse {
  type: AuthErrorType;
  message: string;
}

export class AuthErrorHandler {
  static handle(error: any): AuthErrorResponse {
    const message = error?.message || '';
    const status = error?.status;

    // Supabase Auth Error Mapping
    if (message.includes('Invalid login credentials')) {
      return {
        type: 'invalid_credentials',
        message: 'Invalid email or password. Please check your credentials and try again.'
      };
    }

    if (message.includes('Email not confirmed')) {
      return {
        type: 'email_not_confirmed',
        message: 'Your email has not been verified yet. Please check your inbox for the confirmation link.'
      };
    }

    if (message.includes('User already registered') || message.includes('already exists')) {
      return {
        type: 'user_exists',
        message: 'This email is already registered. Please log in instead.'
      };
    }

    if (message.includes('Password should be')) {
      return {
        type: 'weak_password',
        message: 'Password is too weak. It must be at least 6 characters long.'
      };
    }

    if (message.includes('Unable to validate email') || message.includes('Email is invalid')) {
      return {
        type: 'invalid_email',
        message: 'The email address provided is invalid.'
      };
    }

    if (status === 0 || message.toLowerCase().includes('fetch') || message.toLowerCase().includes('network')) {
      return {
        type: 'network_error',
        message: 'Network connection failed. Please check your internet and try again.'
      };
    }

    // Default error
    return {
      type: 'unknown',
      message: message || 'An unexpected error occurred during authentication.'
    };
  }
}
