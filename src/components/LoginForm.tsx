"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeButton } from '@/components/ui/theme-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, UserPlus, RefreshCw } from 'lucide-react';
import Image from 'next/image';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
      <Card className="w-full max-w-md bg-[#1a1a1a] border-[#2d2d2d] text-white">
        <CardHeader>
          <div className="flex flex-col items-center space-y-4">
            <Image 
              src="/gt-256.png" 
              alt="GT Logo" 
              width={48} 
              height={48} 
              className="object-contain" 
            />
            <CardTitle className="text-2xl text-center">Good Theta</CardTitle>
            <CardDescription className="text-center text-[#b3b3b3]">
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-1p-ignore data-lpignore="true" data-form-type="other">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Email
              </label>
                             <input
                 id="email"
                 type="email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
                 autoComplete="username"
                 data-1p-ignore
                 data-lpignore="true"
                 data-form-type="login"
                 autoFocus
                 className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="Enter your email"
               />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="login"
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <ThemeButton
              type="submit"
              icon={isSignUp ? UserPlus : LogIn}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </ThemeButton>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-[#b3b3b3] hover:text-white flex items-center justify-center mx-auto space-x-2"
              >
                <RefreshCw size={16} />
                <span>{isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}</span>
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
