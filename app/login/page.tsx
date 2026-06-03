"use client";

import { useState } from "react";
import { supabase } from "../supabase"; 
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Success! Please check your email for a confirmation link to activate your vault.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/vendor"); 
      }
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      
      {/* --- MINIMAL HEADER --- */}
      <header className="px-6 py-6 flex items-center justify-between w-full max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-8 h-8 object-contain rounded-md shadow-sm" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 flex items-center">
              TimbreBox <span className="text-gray-300 font-light mx-2 text-lg">/</span> <span className="text-gray-500 font-bold text-sm tracking-wide uppercase mt-0.5">Login</span>
            </h1>
          </div>
        </Link>
        <Link href="/" className="text-sm font-bold text-gray-500 hover:text-emerald-600 transition flex items-center gap-2">
          ← Back to Radar
        </Link>
      </header>

      {/* --- SPLIT SCREEN LAYOUT --- */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-xl border border-gray-200 overflow-hidden flex flex-col md:flex-row">
          
          {/* LEFT SIDE: MESSAGING & VALUE PROPOSITION */}
          <div className="w-full md:w-5/12 bg-gray-900 p-10 sm:p-14 text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>
            
            <div className="relative z-10">
              <span className="text-emerald-400 font-black uppercase tracking-widest text-xs mb-4 block">
                Collector Membership
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 leading-tight">
                Archive, organize, and connect.
              </h2>
              <p className="text-gray-400 font-medium text-sm sm:text-base leading-relaxed mb-8">
                As a member, you unlock powerful tools to catalog your inventory and easily search your personal vinyl collection. 
                Keep your vault entirely private for your own peace of mind, or easily broadcast records to the local community simply by setting an asking price and snapping high-res photos for buyers.
              </p>

              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-sm">✓</div>
                  <p className="text-sm font-bold text-gray-300">Smart Barcode & Catalog OCR Scanner</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-sm">✓</div>
                  <p className="text-sm font-bold text-gray-300">Private Vault Organization</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 text-sm">✓</div>
                  <p className="text-sm font-bold text-gray-300">Zero-Friction Public Broadcasting</p>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT SIDE: AUTH FORM */}
          <div className="w-full md:w-7/12 p-10 sm:p-16 flex flex-col justify-center bg-white">
            <div className="max-w-md w-full mx-auto">
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                {isSignUp ? "Create your free account" : "Welcome back"}
              </h3>
              <p className="text-sm text-gray-500 font-medium mb-8">
                {isSignUp 
                  ? "Start cataloging your collection in seconds." 
                  : "Enter your credentials to access your private vault."}
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold text-center">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-bold text-center">
                  {message}
                </div>
              )}

              <form onSubmit={handleAuth} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1 mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-gray-50 transition outline-none font-medium"
                    placeholder="collector@example.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1 mb-1.5 block">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 bg-gray-50 transition outline-none font-medium"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-gray-900 hover:bg-emerald-600 text-white font-black py-4 rounded-xl transition shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                >
                  {loading ? "Processing..." : isSignUp ? "Create Vault" : "Unlock Vault"}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                    setMessage("");
                  }}
                  className="text-sm font-bold text-gray-500 hover:text-emerald-700 transition"
                >
                  {isSignUp
                    ? "Already have an account? Sign In"
                    : "Don't have an account? Register Here"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
