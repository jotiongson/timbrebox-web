"use client";

import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      // Redirect seamlessly to the vendor dashboard upon successful login
      window.location.href = "/vendor";
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm animate-fade-in">
        
        {/* Branding Headers */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 mb-3">
            <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-full h-full object-contain rounded-xl shadow-sm" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Welcome to TimbreBox</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Log in to unlock your dynamic vendor vault</p>
        </div>

        {/* Form Panel */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1.5 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              placeholder="vendor@example.com"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1.5 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg break-words mt-1">
              ⚠️ {errorMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold transition shadow-sm mt-2 disabled:opacity-50"
          >
            {loading ? "Verifying Credentials..." : "Unlock Vault"}
          </button>
        </form>

      </div>
    </main>
  );
}
