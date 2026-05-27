'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import StoreSettings from '../StoreSettings';

export default function SettingsPage() {
  // --- AUTHENTICATION STATE (THE BOUNCER) ---

  // PROD UNCOMMENT FOR PROD
  const [session, setSession] = useState<any>(null);

  // TEST COMMENT FOR TEST
  //const [session, setSession] = useState<any>({
  //  user: {
  //    id: '66d6def4-2425-4248-9b90-7c418f1fd4ae',
  //    email: 'dev-mode@vault.com'
  //  }
  //});

  TEST - UNCOMMENT FOR PROD
    useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 font-semibold">Access Denied. Please log in from the main vendor dashboard.</p>
      </div>
    );
  }

  return (
    <main className="p-8 max-w-5xl mx-auto font-sans relative animate-fade-in">
      <header className="border-b border-gray-200 pb-5 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Store Settings</h1>
          <p className="text-emerald-600 text-sm mt-1 font-semibold">Configuration • {session.user.email}</p>
        </div>
        <div className="flex gap-4">
          <a href="/vendor" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg">
            ← Back to Vault
          </a>
        </div>
      </header>

      {/* THE IMPORTED STORE SETTINGS MODULE */}
      <StoreSettings userId={session.user.id} />
      
    </main>
  );
}
