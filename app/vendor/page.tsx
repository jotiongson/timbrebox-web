'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import BarcodeScanner from '../components/BarcodeScanner';
import { searchDiscogsByBarcode, searchDiscogsByText, getDiscogsReleaseDetails } from '../services/discogsService';

interface InventoryItem {
  id: number;
  artist: string;
  title: string;
  weight_grams: number;
  price_cents: number;
  status: string;
  location?: string;
  year?: string;
  genres?: string[];
  tracklist?: any[];
  cover_image?: string;
}

// 1. CREATE THE FORM BLUEPRINT
const initialFormState = {
  title: '',
  artist: '',
  price: '',
  weight: '180',
  quantity: '1',
  location: '',
  year: '',
  genres: [] as string[],
  tracklist: [] as any[],
  coverImage: ''
};

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
  
  // 2. CONSOLIDATED FORM STATE
  const [formData, setFormData] = useState(initialFormState);
  
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);

  const [itemToArchive, setItemToArchive] = useState<InventoryItem | null>(null);
  const [archiveProcessing, setArchiveProcessing] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [textQuery, setTextQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingText, setIsSearchingText] = useState(false);

  // EDIT MODULE STATE
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [editFormSubmitting, setEditFormSubmitting] = useState(false);

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
        .select('id, artist, title, weight_grams, price_cents, location, year, genres, cover_image')
        .eq('status', status)
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

  // 3. UNIVERSAL INPUT HANDLER
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.artist || !formData.price || !session) return;

    try {
      setFormSubmitting(true);
      const priceCents = Math.round(parseFloat(formData.price) * 100);
      const weightGrams = parseInt(formData.weight, 10) || 180;

      const { error } = await supabase.from('inventory').insert([
        {
          vendor_id: session.user.id,
          title: formData.title.trim(),
          artist: formData.artist.trim(),
          weight_grams: weightGrams,
          price_cents: priceCents,
          quantity: parseInt(formData.quantity, 10) || 1,
          status: 'available',
          location: formData.location.trim(),
          year: formData.year,
          genres: formData.genres,
          tracklist: formData.tracklist,
          cover_image: formData.coverImage || ""
        },
      ]);

      if (error) throw error;

      // Reset form instantly
      setFormData(initialFormState);
      setViewMode('available');
      await fetchInventory('available');
      
    } catch (err: any) {
      alert(`Database insertion failure: ${err.message}`);
    } finally {
      setFormSubmitting(false);
    }
  }

async function handleUpdateRecord(e: React.FormEvent) {
  e.preventDefault();
  if (!itemToEdit || !session) return;

  try {
    setEditFormSubmitting(true);
    const priceCents = Math.round(parseFloat(formData.price) * 100);
    const weightGrams = parseInt(formData.weight, 10) || 180;

    // Use null-coalescing (|| "") to ensure we never send 'undefined' to the database
    const { error } = await supabase.from('inventory').update({
        title: formData.title.trim() || "",
        artist: formData.artist.trim() || "",
        weight_grams: weightGrams,
        price_cents: priceCents,
        location: formData.location ? formData.location.trim() : null, // Send null if empty
        year: formData.year || null,
        genres: formData.genres || [],
        cover_image: formData.coverImage || "" 
      }).eq('id', itemToEdit.id);

    if (error) throw error;

    // Clean up and refresh
    setItemToEdit(null);
    setFormData(initialFormState);
    await fetchInventory(viewMode);
    
  } catch (err: any) {
    alert(`Database update failure: ${err.message}`);
  } finally {
    setEditFormSubmitting(false);
  }
}

  // Pre-fill the form data object when editing
  function openEditModal(album: InventoryItem) {
    setItemToEdit(album);
    setFormData({
      ...initialFormState,
      title: album.title,
      artist: album.artist,
      price: (album.price_cents / 100).toFixed(2),
      weight: album.weight_grams.toString(),
      location: album.location || '',
      year: album.year || '',
      genres: album.genres || [],
      tracklist: album.tracklist || [],
      coverImage: album.cover_image || ''
    });
  }

  async function handleTextSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!textQuery) return;
    
    setIsSearchingText(true);
    setLookupError('');
    
    const result = await searchDiscogsByText(textQuery);
    if (result.success) {
      setSearchResults(result.results);
      if (result.results.length === 0) setLookupError("No matches found for that text.");
    } else {
      setLookupError(result.error || "Text search failed.");
    }
    setIsSearchingText(false);
  }

  async function handleSelectRelease(releaseId: number) {
    setSearchResults([]); 
    setTextQuery('');    
    setIsSearchingText(true);
    setLookupError('');
    
    const result = await getDiscogsReleaseDetails(releaseId);
    if (result.success) {
      // Bulk update the state!
      setFormData(prev => ({
        ...prev,
        artist: result.artist,
        title: result.title,
        year: result.year || '',
        genres: result.genres || [],
        tracklist: result.tracklist || [],
        coverImage: result.cover_image || ''
      }));
    } else {
      setLookupError(result.error || "Failed to load specific release details.");
    }
    setIsSearchingText(false);
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

  return (
    <main className="p-8 max-w-5xl mx-auto font-sans relative animate-fade-in">
      <header className="border-b border-gray-200 pb-5 mb-8 flex justify-between items-end">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex-shrink-0">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
              <ellipse cx="50" cy="28" rx="24" ry="12" fill="#1F2937" />
              <ellipse cx="50" cy="28" rx="8" ry="4" fill="#059669" />
              <ellipse cx="50" cy="28" rx="2" ry="1" fill="#D1D5DB" />
              <path d="M15 42 L50 60 L50 92 L15 74 Z" fill="#1F2937" />
              <path d="M85 42 L50 60 L50 92 L85 74 Z" fill="#374151" />
              <path d="M15 42 L50 24 L85 42 L50 60 Z" fill="none" stroke="#059669" strokeWidth="5" strokeLinejoin="round" />
              <path d="M25 50 L25 80 M35 55 L35 85" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
              <path d="M75 50 L75 80 M65 55 L65 85" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">TimbreBox</h1>
            <p className="text-emerald-600 text-sm mt-1 font-semibold">Secure Vault Unlocked • {session.user.email}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <a href="/vendor/settings" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg">⚙️ Settings</a>
          <a href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg">View Radar</a>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-red-500 hover:text-white transition border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg">Sign Out</button>
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 max-w-3xl mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight">Add New Stock Insertion</h2>
        
        <form onSubmit={handleAddRecord} className="grid gap-5 sm:grid-cols-2 md:grid-cols-4 items-end">
          
          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Text Search</span>
              <span className="text-emerald-600 font-medium">Top 10 Matches</span>
            </label>
            <div className="flex gap-2 mt-1.5">
              <input 
                type="text" 
                placeholder="e.g. Pink Floyd Dark Side" 
                value={textQuery} 
                onChange={(e) => setTextQuery(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSearch(e); }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              />
              <button 
                type="button" 
                onClick={handleTextSearch}
                disabled={isSearchingText || !textQuery}
                className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-6 py-2 text-sm font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSearchingText ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg bg-white shadow-sm max-h-64 overflow-y-auto">
                {searchResults.map((res: any) => (
                  <div 
                    key={res.id} 
                    onClick={() => handleSelectRelease(res.id)}
                    className="p-3 border-b border-gray-100 hover:bg-emerald-50 cursor-pointer flex gap-3 items-center transition last:border-b-0"
                  >
                    {res.thumb ? (
                      <img src={res.thumb} alt="cover" className="w-12 h-12 object-cover rounded shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">No Img</div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 leading-tight">{res.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {res.year || 'Unknown Year'} • {res.country || 'Unknown Region'} • {res.format?.slice(0, 2).join(', ') || 'Vinyl'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  // Bulk update via the barcode API return!
                  setFormData(prev => ({
                    ...prev,
                    artist: result.artist,
                    title: result.title,
                    year: result.year || '',
                    genres: result.genres || [],
                    tracklist: result.tracklist || [],
                    coverImage: result.cover_image || ''
                  }));
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

          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="title"
              required 
              value={formData.title} 
              onChange={handleInputChange} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="e.g. Somethin' Else" 
            />
          </div>

          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="artist"
              required 
              value={formData.artist} 
              onChange={handleInputChange} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="e.g. Cannonball Adderley" 
            />
          </div>

          <div className="w-full">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Price ($) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              name="price"
              step="0.01" 
              required 
              value={formData.price} 
              onChange={handleInputChange} 
              className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              placeholder="24.99" 
            />
          </div>

          {/* I UPGRADED THIS GRID TO 3 COLUMNS TO HOLD YOUR LOCATION INPUT */}
          <div className="grid grid-cols-3 gap-3 w-full items-end">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
              <input 
                type="number" 
                name="weight"
                value={formData.weight} 
                onChange={handleInputChange} 
                className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                placeholder="180" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
              <input 
                type="number" 
                name="quantity"
                min="1" 
                value={formData.quantity} 
                onChange={handleInputChange} 
                className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                placeholder="1" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Location</label>
              <input 
                type="text" 
                name="location"
                value={formData.location} 
                onChange={handleInputChange} 
                className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                placeholder="e.g. Bin A" 
              />
            </div>
          </div>

          {lookupError && (
            <div className="sm:col-span-2 md:col-span-4 text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
              {lookupError}
            </div>
          )}

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
              <div key={album.id} className="border border-gray-200 rounded-2xl p-4 shadow-sm bg-white flex flex-col justify-between transition hover:shadow-md w-full sm:w-80">
                <div className="flex gap-4 items-start">
                  {album.cover_image && album.cover_image.length > 0 ? (
                    <img 
                      src={album.cover_image} 
                      alt="cover" 
                      className="w-20 h-20 object-cover rounded-lg shadow-sm shrink-0 border border-gray-100" 
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 border border-gray-200 text-xs text-gray-400 font-medium">No Image</div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-gray-900 tracking-tight leading-snug truncate">{album.title}</h3>
                    <p className="text-gray-500 font-medium text-sm truncate">{album.artist}</p>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {album.year && <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{album.year}</span>}
                      {album.genres && album.genres.length > 0 && (
                        <span className="text-xs text-emerald-600 font-medium truncate">{album.genres[0]}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Location</span>
                    <span className="text-gray-700 text-sm font-semibold">{album.location || 'Unassigned'}</span>
                  </div>
                  <span className="font-bold text-emerald-600 text-lg">${(album.price_cents / 100).toFixed(2)}</span>
                </div>

                <div className="mt-3 flex gap-2">
                  {viewMode === 'available' ? (
                    <>
                      <button onClick={() => openEditModal(album)} className="flex-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 py-2 rounded-lg transition">Edit</button>
                      <button onClick={() => setItemToArchive(album)} className="flex-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition">Archive</button>
                    </>
                  ) : (
                    <button onClick={() => handleRestoreRecord(album.id)} className="w-full text-xs font-semibold text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 py-2 rounded-lg transition border border-emerald-200 hover:border-emerald-600">Restore</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

      {itemToEdit && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xl max-w-md w-full animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-4 border-b border-gray-100 pb-3">Edit Inventory Record</h3>
            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title</label>
                <input type="text" name="title" required value={formData.title} onChange={handleInputChange} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist</label>
                <input type="text" name="artist" required value={formData.artist} onChange={handleInputChange} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Price ($)</label>
                  <input type="number" name="price" step="0.01" required value={formData.price} onChange={handleInputChange} className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="e.g. Bin A" className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6 pt-2">
                <button type="button" onClick={() => { setItemToEdit(null); setFormData(initialFormState); }} className="w-full px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition text-center">Cancel</button>
                <button type="submit" disabled={editFormSubmitting} className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition text-center shadow-sm disabled:opacity-50">{editFormSubmitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner 
          onClose={() => setShowScanner(false)} 
          onScanSuccess={async (scannedCode) => {
            setShowScanner(false);
            setBarcode(scannedCode);
            
            setIsSearchingDiscogs(true);
            const result = await searchDiscogsByBarcode(scannedCode);
            if (result?.success) {
              setFormData(prev => ({
                ...prev,
                artist: result.artist,
                title: result.title,
                year: result.year || '',
                genres: result.genres || [],
                tracklist: result.tracklist || [],
                coverImage: result.cover_image || ''
              }));
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