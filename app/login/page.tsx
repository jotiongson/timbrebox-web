'use client';

import { useState } from 'react';
import { supabase } from '../supabase'; // Adjust path if necessary
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      // --- CREATING A NEW ACCOUNT ---
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Account created successfully! Logging you in...');
        router.push('/vendor');
      }
    } else {
      // --- LOGGING IN AN EXISTING ACCOUNT ---
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        router.push('/vendor');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">TimbreBox</h1>
          <p className="text-gray-500">Unlock your vinyl collection</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm font-bold ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need a Vinyl Collection Vault? Create an Account'}
          </button>

          {/* --- ADD THIS NEW BLOCK BELOW YOUR TOGGLE BUTTON --- */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <a 
              href="/" 
              className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-full text-sm transition shadow-sm"
            >
              🎯 Scan Guest Radar
            </a>
          </div>
          {/* ------------------------------------------------ */}
          
        </div>
      </div>
    </div>
  );
}
