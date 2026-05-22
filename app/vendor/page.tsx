"use client";

import { useState, useEffect } from "react";
// Adjust these import paths if your services are located differently
import { supabase } from "../services/supabase"; 
import { searchDiscogsByBarcode } from "../services/discogsService";

interface InventoryItem {
  id: number;
  artist: string;
  title: string;
  weight_grams: number;
  price_cents: number;
  status?: string;
  quantity?: number;
  location?: string;
  year?: string;
  genres?: string[];
  tracklist?: any[];
  cover_image?: string;
}

const initialFormState = {
  title: "",
  artist: "",
  price: "",
  weight: "",
  quantity: "1",
  location: "",
};

export default function VendorDashboard() {
  const [session, setSession] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form & Search States
  const [formData, setFormData] = useState(initialFormState);
  const [barcode, setBarcode] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Loading & UI States
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [isSearchingText, setIsSearchingText] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchInventory();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchInventory() {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("id, artist, title, weight_grams, price_cents, quantity, location, year, genres, cover_image")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching inventory:", error);
    } else {
      setInventory(data || []);
    }
    setLoading(false);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Discogs Text Search Logic (Placeholder for your implementation)
  const handleTextSearch = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!textQuery) return;
    setIsSearchingText(true);
    // Add your text search logic here
    setIsSearchingText(false);
  };

  const handleSelectRelease = (id: string) => {
    // Add your release selection logic here
    setSearchResults([]);
  };

  // Main Submit Logic (Handles both Create and Update)
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setLookupError("");

    const payload = {
      title: formData.title,
      artist: formData.artist,
      price_cents: Math.round(parseFloat(formData.price) * 100),
      weight_grams: parseInt(formData.weight) || 0,
      quantity: parseInt(formData.quantity) || 1,
      location: formData.location,
      // Add other fields (year, genres, cover_image) if you have them stored in state
    };

    if (itemToEdit) {
      const { error } = await supabase
        .from("inventory")
        .update(payload)
        .eq("id", itemToEdit.id);

      if (error) setLookupError(error.message);
      else {
        setItemToEdit(null);
        setFormData(initialFormState);
        fetchInventory();
      }
    } else {
      const { error } = await supabase.from("inventory").insert([payload]);
      if (error) setLookupError(error.message);
      else {
        setFormData(initialFormState);
        setBarcode("");
        fetchInventory();
      }
    }
    setFormSubmitting(false);
  };

  function openEditModal(album: InventoryItem) {
    setItemToEdit(album);
    setFormData({
      ...initialFormState,
      title: album.title,
      artist: album.artist,
      price: (album.price_cents / 100).toFixed(2),
      weight: album.weight_grams.toString(),
      quantity: (album.quantity || 1).toString(),
      location: album.location || "",
    });
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 font-medium animate-pulse">Loading secure vault...</p>
      </div>
    );
  }

  return (
    <main className="p-4 sm:p-8 w-full max-w-full overflow-x-hidden mx-auto font-sans relative animate-fade-in">
      
      {/* 1. RESPONSIVE HEADER */}
      <header className="border-b border-gray-200 pb-5 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-5 w-full">
        <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
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
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight truncate">TimbreBox</h1>
            <p className="text-emerald-600 text-sm mt-1 font-semibold truncate">Vault Unlocked • {session.user.email}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full md:w-auto">
          <a href="/vendor/settings" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">⚙️ Settings</a>
          <a href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">View Radar</a>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-red-500 hover:text-white transition border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">Sign Out</button>
        </div>
      </header>

      {/* 2. CONSTRAINED FORM SECTION */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 w-full max-w-full overflow-hidden mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight">
          {itemToEdit ? "Edit Stock Insertion" : "Add New Stock Insertion"}
        </h2>
        
        <form onSubmit={handleAddRecord} className="grid gap-5 sm:grid-cols-2 md:grid-cols-4 items-end w-full">
          
          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2 w-full min-w-0 overflow-hidden">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Text Search</span>
              <span className="text-emerald-600 font-medium">Top 10 Matches</span>
            </label>
            <div className="flex gap-2 mt-1.5 w-full">
              <input 
                type="text" 
                placeholder="e.g. Pink Floyd Dark Side" 
                value={textQuery} 
                onChange={(e) => setTextQuery(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSearch(e); }}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
              />
              <button 
                type="button" 
                onClick={handleTextSearch}
                disabled={isSearchingText || !textQuery}
                className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 sm:px-6 py-2 text-sm font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSearchingText ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg bg-white shadow-sm max-h-64 overflow-y-auto w-full">
                {searchResults.map((res: any) => (
                  <div 
                    key={res.id} 
                    onClick={() => handleSelectRelease(res.id)}
                    className="p-3 border-b border-gray-100 hover:bg-emerald-50 cursor-pointer flex gap-3 items-center transition last:border-b-0"
                  >
                    {res.thumb ? (
                      <img src={res.thumb} alt="cover" className="w-12 h-12 object-cover rounded shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400 flex-shrink-0">No Img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 leading-tight truncate">{res.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {res.year || 'Unknown Year'} • {res.country || 'Unknown Region'} • {res.format?.slice(0, 2).join(', ') || 'Vinyl'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row gap-3 items-end mb-2 w-full min-w-0 overflow-hidden">
            <div className="flex-1 w-full min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                <span>Barcode Lookup</span>
                <span className="text-emerald-600 font-medium">Powered by Discogs</span>
              </label>
              <div className="flex gap-2 mt-1.5 w-full">
                <input 
                  type="text" 
                  placeholder="Type UPC barcode here..." 
                  value={barcode} 
                  onChange={(e) => setBarcode(e.target.value)} 
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                />
                <button 
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-bold transition flex items-center gap-2 shadow-sm"
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
              className="w-full sm:w-auto flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6 py-2 text-sm font-bold transition shadow-sm disabled:opacity-50"
            >
              {isSearchingDiscogs ? 'Searching...' : 'Lookup API'}
            </button>
          </div>

          <div className="w-full min-w-0">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title <span className="text-red-500">*</span></label>
            <input type="text" name="title" required value={formData.title} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="e.g. Somethin' Else" />
          </div>

          <div className="w-full min-w-0">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist <span className="text-red-500">*</span></label>
            <input type="text" name="artist" required value={formData.artist} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="e.g. Cannonball Adderley" />
          </div>

          <div className="w-full min-w-0">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Price ($) <span className="text-red-500">*</span></label>
            <input type="number" name="price" step="0.01" required value={formData.price} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="24.99" />
          </div>

          <div className="sm:col-span-2 md:col-span-4 grid grid-cols-2 sm:grid-cols-5 gap-3 w-full items-end">
            <div className="col-span-1 min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
              <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="180" />
            </div>
            <div className="col-span-1 min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
              <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="1" />
            </div>
            <div className="col-span-2 sm:col-span-3 min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="e.g. Bin A - Top Shelf" />
            </div>
          </div>

          {lookupError && (
            <div className="sm:col-span-2 md:col-span-4 text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 w-full break-words">
              {lookupError}
            </div>
          )}

          <div className="sm:col-span-2 md:col-span-4 mt-2 w-full flex gap-3">
             {itemToEdit && (
              <button 
                type="button" 
                onClick={() => { setItemToEdit(null); setFormData(initialFormState); }}
                className="w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl py-3.5 text-sm font-bold transition shadow-sm"
              >
                Cancel Edit
              </button>
            )}
            <button 
              type="submit" 
              disabled={formSubmitting || isSearchingDiscogs} 
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {formSubmitting ? 'Writing to Vault...' : (itemToEdit ? 'Update Inventory' : 'Save to Inventory')}
            </button>
          </div>

        </form>
      </section>

      {/* 3. CURRENT INVENTORY GRID */}
      <section className="mb-12">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight border-b border-gray-200 pb-2">Current Active Stock</h2>
        
        {loading ? (
          <p className="text-gray-500 animate-pulse">Loading inventory...</p>
        ) : inventory.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-200 border-dashed">
            <p className="text-gray-500 font-medium">Your vault is empty. Start scanning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {inventory.map((album) => (
              <div key={album.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition group flex flex-col w-full overflow-hidden">
                <div className="flex gap-4 items-start w-full">
                   {album.cover_image ? (
                      <img src={album.cover_image} alt="cover" className="w-16 h-16 object-cover rounded shadow-sm flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl opacity-40">💿</span>
                      </div>
                    )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight truncate">{album.title}</h3>
                    <p className="text-gray-500 text-sm font-medium mt-1 truncate">{album.artist}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-semibold">{album.weight_grams}g</span>
                      {album.year && <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-semibold">{album.year}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center w-full">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Loc / Qty</span>
                    <span className="text-gray-700 text-sm font-semibold truncate">
                      {album.location || 'Unassigned'} <span className="text-emerald-600 ml-1">• x{album.quantity || 1}</span>
                    </span>
                  </div>
                  <span className="font-bold text-emerald-600 text-lg flex-shrink-0">${(album.price_cents / 100).toFixed(2)}</span>
                </div>
                
                <div className="mt-4 flex gap-2 w-full">
                  <button onClick={() => openEditModal(album)} className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 py-1.5 rounded-lg text-xs font-bold transition">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}