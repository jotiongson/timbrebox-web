'use client';

import StoreSettings from './StoreSettings';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { searchDiscogsByBarcode } from '../services/discogsService';
import BarcodeScanner from '../components/BarcodeScanner';

interface InventoryItem {
  id: number;
  artist: string;
  title: string;
  weight_grams: number;
  price_cents: number;
}

export default function VendorDashboard() {
  // --- AUTHENTICATION STATE (THE BOUNCER) ---

  // PROD UNCOMMENT FOR PROD
  //const [session, setSession] = useState<any>(null);

  // TEST COMMENT FOR TEST
  const [session, setSession] = useState<any>({
    user: {
      id: '66d6def4-2425-4248-9b90-7c418f1fd4ae',
      email: 'dev-mode@vault.com'
    }
  });


  const [authEmail, setAuthEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // --- VAULT STATE ---
  const [listings, setListings] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'available' | 'archived'>('available');
  
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [weight, setWeight] = useState('180');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);

  const [itemToArchive, setItemToArchive] = useState<InventoryItem | null>(null);
  const [archiveProcessing, setArchiveProcessing] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // 1. INITIALIZE SESSION BOUNCER
  /* TEST - UNCOMMENT FOR PROD
    useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  */

  // 2. MAGIC LINK DISPATCHER
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('Dispatching secure token...');
    
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: window.location.origin + '/vendor' },
    });

    if (error) {
      setAuthMessage(`Error: ${error.message}`);
    } else {
      setAuthMessage('Magic Link sent! Check your inbox to unlock the vault.');
    }
    setAuthLoading(false);
  }

  // 3. FETCH INVENTORY (Only runs if unlocked)
  useEffect(() => {
    if (session) {
      fetchInventory(viewMode);
    }
  }, [session, viewMode]);

  async function fetchInventory(status: 'available' | 'archived') {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('id, artist, title, weight_grams, price_cents')
        .eq('status', status)
        // SECURITY: Only fetch records belonging to the logged-in vendor!
        .eq('vendor_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (err: any) {
      console.error('Database fetch routine failure:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // 4. SECURE INSERTION
  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !artist || !price || !session) return;

    try {
      setFormSubmitting(true);
      const priceCents = Math.round(parseFloat(price) * 100);
      const weightGrams = parseInt(weight, 10) || 180;

      const { error } = await supabase.from('inventory').insert([
        {
          // SECURITY: Tie the record to the real auth token ID, not the fake 0000 ID
          vendor_id: session.user.id,
          title: title.trim(),
          artist: artist.trim(),
          weight_grams: weightGrams,
          price_cents: priceCents,
          quantity: parseInt(quantity, 10) || 1,
          status: 'available',
        },
      ]);

      if (error) throw error;

      setTitle('');
      setArtist('');
      setPrice('');
      setViewMode('available');
      await fetchInventory('available');
    } catch (err: any) {
      alert(`Database insertion failure: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function confirmArchive() {
    if (!itemToArchive) return;
    try {
      setArchiveProcessing(true);
      const { error } = await supabase.from('inventory').update({ status: 'archived' }).eq('id', itemToArchive.id);
      if (error) throw error;
      setItemToArchive(null);
      await fetchInventory(viewMode);
    } catch (err: any) {
      alert(`Could not archive: ${err.message}`);
    } finally {
      setArchiveProcessing(false);
    }
  }

  async function handleRestoreRecord(id: number) {
    try {
      const { error } = await supabase.from('inventory').update({ status: 'available' }).eq('id', id);
      if (error) throw error;
      await fetchInventory(viewMode);
    } catch (err: any) {
      alert(`Could not restore: ${err.message}`);
    }
  }

  // --- RENDER BOUNCER UI IF NOT LOGGED IN ---
  if (!session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl p-10 shadow-xl max-w-md w-full animate-fade-in border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Vendor Vault</h1>
            <p className="text-gray-500 text-sm">Sign in via Magic Link to manage your local inventory.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">Email Address</label>
              <input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full mt-1.5 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50" placeholder="vinyl@example.com" />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 mt-2">
              {authLoading ? 'Authenticating...' : 'Send Magic Link'}
            </button>
            {authMessage && (
              <p className={`text-sm text-center font-medium mt-4 p-3 rounded-lg ${authMessage.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {authMessage}
              </p>
            )}
          </form>
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <a href="/" className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition">← Back to Public Radar</a>
          </div>
        </div>
      </main>
    );
  }

  // --- RENDER VAULT UI IF LOGGED IN ---
  return (
    <main className="p-8 max-w-5xl mx-auto font-sans relative animate-fade-in">
      <header className="border-b border-gray-200 pb-5 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">TimbreBox</h1>
          <p className="text-emerald-600 text-sm mt-1 font-semibold">Secure Vault Unlocked • {session.user.email}</p>
        </div>
        <div className="flex gap-4">
          <a href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg">View Radar</a>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-red-500 hover:text-white transition border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg">Sign Out</button>
        </div>
      </header>

      {/* NEW: THE STORE SETTINGS MODULE */}
      <StoreSettings userId={session.user.id} />

      {/* COMPONENT A: INTERACTIVE INSERTION ENGINE */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 max-w-3xl mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight">Add New Stock Insertion</h2>
        
        <form onSubmit={handleAddRecord} className="grid gap-5 sm:grid-cols-2 md:grid-cols-4 items-end">
          
          {/* THE DISCOGS BARCODE ENGINE */}
          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row gap-3 items-end mb-2">
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                <span>Barcode Lookup</span>
                <span className="text-emerald-600 font-medium">Powered by Discogs</span>
              </label>
              <div className="flex gap-2 mt-1.5">
                <input 
                  type="text" 
                  placeholder="Type UPC barcode here..." 
                  value={barcode} 
                  onChange={(e) => setBarcode(e.target.value)} 
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                />
                <button 
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-bold transition flex items-center gap-2 shadow-sm"
                >
                  📷 Scan
                </button>
              </div>
            </div>
            <button 
              type="button" 
              onClick={async () => {
                if (!barcode) return;
                setIsSearchingDiscogs(true);
                const result = await searchDiscogsByBarcode(barcode);
                if (result?.success) {
                  setArtist(result.artist);
                  setTitle(result.title);
                } else {
                  alert(result?.error || "Barcode lookup failed.");
                }
                setIsSearchingDiscogs(false);
              }}
              disabled={isSearchingDiscogs || !barcode}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-2 text-sm font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSearchingDiscogs ? 'Searching...' : 'Lookup API'}
            </button>
          </div>

          {/* THE MANUAL INPUT FIELDS */}
          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="e.g. Somethin' Else" 
            />
          </div>

          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              value={artist} 
              onChange={(e) => setArtist(e.target.value)} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="e.g. Cannonball Adderley" 
            />
          </div>

          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Price ($) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="24.99" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
              <input 
                type="number" 
                value={weight} 
                onChange={(e) => setWeight(e.target.value)} 
                className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                placeholder="180" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
              <input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                placeholder="1" 
              />
            </div>
          </div>

          {/* DEDICATED ERROR PAPER TRAIL */}
          {lookupError && (
            <div className="sm:col-span-2 md:col-span-4 text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
              {lookupError}
            </div>
          )}

          {/* SUBMISSION ACTION */}
          <div className="sm:col-span-2 md:col-span-4 mt-2">
            <button 
              type="submit" 
              disabled={formSubmitting || isSearchingDiscogs} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {formSubmitting ? 'Writing to Vault...' : 'Save to Inventory'}
            </button>
          </div>

        </form>

      </section>

      {/* COMPONENT B: DISPLAY MONITOR GRID & TOGGLE TABS */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">{viewMode === 'available' ? 'Current Active Stock' : 'Archived Vault History'}</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button onClick={() => setViewMode('available')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-lg transition ${viewMode === 'available' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Active</button>
            <button onClick={() => setViewMode('archived')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-semibold rounded-lg transition ${viewMode === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Vault</button>
          </div>
        </div>
        
        {loading ? (
          <div className="text-gray-400 text-sm italic animate-pulse">Querying secure vault...</div>
        ) : listings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 border-dashed rounded-2xl p-10 text-center text-gray-400 text-sm">
            {viewMode === 'available' ? 'No active listings found.' : 'Your vault is currently empty.'}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((album: InventoryItem) => (
              <div key={album.id} className="border border-gray-200 rounded-2xl p-6 shadow-sm bg-white flex flex-col justify-between transition hover:shadow-md w-full sm:w-72">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-lg text-gray-900 tracking-tight leading-snug mb-1">{album.title}</h3>
                    {viewMode === 'available' ? (
                      <button onClick={() => setItemToArchive(album)} className="text-xs font-semibold text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 px-2 py-1 rounded-lg transition border border-gray-200 hover:border-red-100 shrink-0">Archive</button>
                    ) : (
                      <button onClick={() => handleRestoreRecord(album.id)} className="text-xs font-semibold text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 px-2 py-1 rounded-lg transition border border-emerald-200 hover:border-emerald-600 shrink-0">Restore</button>
                    )}
                  </div>
                  <p className="text-gray-500 font-medium text-sm">{album.artist}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                  <span className="text-gray-400 text-xs">Weight: <strong className="font-bold text-gray-700">{album.weight_grams}g</strong></span>
                  <span className="font-bold text-emerald-600 text-base">${(album.price_cents / 100).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COMPONENT C: ARCHIVE MODAL */}
      {itemToArchive && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl max-w-sm w-full animate-fade-in">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-2">Confirm Archive</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">Are you sure you want to archive <span className="font-semibold text-gray-800">"{itemToArchive.title}"</span>?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setItemToArchive(null)} disabled={archiveProcessing} className="w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition text-center disabled:opacity-50">Cancel</button>
              <button onClick={confirmArchive} disabled={archiveProcessing} className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition text-center shadow-sm disabled:opacity-50">{archiveProcessing ? 'Archiving...' : 'Archive'}</button>
            </div>
          </div>
        </div>
      )}

    {/* THE CAMERA MODAL */}
      {showScanner && (
        <BarcodeScanner 
          onClose={() => setShowScanner(false)} 
          onScanSuccess={async (scannedCode) => {
            setShowScanner(false); // Close the camera
            setBarcode(scannedCode); // Drop the code in the text box
            
            // Auto-fire the Discogs API!
            setIsSearchingDiscogs(true);
            const result = await searchDiscogsByBarcode(scannedCode);
            if (result?.success) {
              setArtist(result.artist);
              setTitle(result.title);
            } else {
              setLookupError(result?.error || "Barcode lookup failed.");
            }
            setIsSearchingDiscogs(false);
          }} 
        />
      )}

    </main>
  );
}