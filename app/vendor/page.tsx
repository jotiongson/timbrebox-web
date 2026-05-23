"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase"; 
import { searchDiscogsByBarcode, searchDiscogsByText, getDiscogsReleaseDetails } from "../services/discogsService";
import BarcodeScanner from "../components/BarcodeScanner";

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
  price: "0", // Defaults to 0 for rapid scanning
  weight: "",
  quantity: "1",
  location: "",
};

export default function VendorDashboard() {
  const session = { user: { id: "00000000-0000-0000-0000-000000000000", email: "dev-mode@vault.com" } };
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form & Discogs Search States
  const [formData, setFormData] = useState(initialFormState);
  const [barcode, setBarcode] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Local Vault Search State
  const [localSearch, setLocalSearch] = useState("");

  // Loading & UI States
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [isSearchingText, setIsSearchingText] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  useEffect(() => {
    fetchInventory();
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

  const handleTextSearch = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!textQuery) return;
    
    setIsSearchingText(true);
    setLookupError("");
    
    try {
      const response = await searchDiscogsByText(textQuery); 
      
      if (response && response.success && response.results && response.results.length > 0) {
        setSearchResults(response.results);
      } else {
        setLookupError(response?.error || "No results found for that search.");
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Text search failed:", err);
      setLookupError("Search failed. Check your API connection.");
    }
    
    setIsSearchingText(false);
  };

  const handleSelectRelease = async (id: number) => {
    setIsSearchingDiscogs(true);
    const result = await getDiscogsReleaseDetails(id);

    if (result?.success) {
      setFormData(prev => ({
        ...prev,
        artist: result.artist,
        title: result.title,
        year: result.year || '',
        genres: result.genres || [],
        tracklist: result.tracklist || [],
        coverImage: result.cover_image || '',
        weight: result.weight || prev.weight 
      }));
    } else {
      alert(result?.error || "Failed to fetch album details.");
    }
    
    setSearchResults([]); 
    setIsSearchingDiscogs(false); 
  };

const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setLookupError("");

    const payload = {
      vendor_id: session.user.id, 
      title: formData.title,
      artist: formData.artist,
      price_cents: Math.round(parseFloat(formData.price) * 100),
      weight_grams: parseInt(formData.weight) || 0,
      quantity: parseInt(formData.quantity) || 1,
      location: formData.location,
    };

    if (itemToEdit) {
      // 1. MANUAL EDIT MODE: Updates everything (price, qty, weight, etc.)
      const { error } = await supabase
        .from("inventory")
        .update(payload)
        .eq("id", itemToEdit.id);

      if (error) setLookupError(error.message);
      else {
        setItemToEdit(null);
        setFormData({ ...initialFormState, location: formData.location });
        fetchInventory();
      }
    } else {
      // 2. QUICK SCAN MODE
      const { data: existingMatches } = await supabase
        .from("inventory")
        .select("id")
        .eq("title", payload.title)
        .eq("artist", payload.artist)
        .eq("vendor_id", session.user.id)
        .limit(1);

      if (existingMatches && existingMatches.length > 0) {
        // OVERRIDE LOGIC: ONLY update the location! Do not touch price or qty.
        const { error } = await supabase
          .from("inventory")
          .update({ location: formData.location }) // <-- The crucial fix
          .eq("id", existingMatches[0].id);

        if (error) {
          setLookupError(error.message);
        } else {
          setFormData({ ...initialFormState, location: formData.location });
          setBarcode("");
          fetchInventory();
        }
      } else {
        // BRAND NEW RECORD: Insert the full payload ($0 price and 1 qty applied)
        const { error } = await supabase.from("inventory").insert([payload]);
        
        if (error) {
          setLookupError(error.message);
        } else {
          setFormData({ ...initialFormState, location: formData.location });
          setBarcode("");
          fetchInventory();
        }
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Powerful Real-time Local Filtering Logic
  const filteredInventory = inventory.filter((album) => {
    if (!localSearch) return true;
    const searchLower = localSearch.toLowerCase();
    
    return (
      album.title.toLowerCase().includes(searchLower) ||
      album.artist.toLowerCase().includes(searchLower) ||
      (album.location && album.location.toLowerCase().includes(searchLower)) ||
      (album.weight_grams && album.weight_grams.toString() === searchLower)
    );
  });

  return (
    <main className="p-4 sm:p-8 w-full max-w-full overflow-x-hidden mx-auto font-sans relative animate-fade-in pb-20">
      
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
          <button className="text-sm font-semibold text-red-500 hover:text-white transition border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">Sign Out</button>
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 w-full max-w-full overflow-hidden mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 tracking-tight">
          {itemToEdit ? "Edit Stock Insertion" : "Add New Stock Insertion"}
        </h2>
        
        <form onSubmit={handleAddRecord} className="grid gap-5 sm:grid-cols-2 md:grid-cols-4 items-end w-full">
          
          {/* THE VIP LOCATION FIELD - Moved to the very top! */}
          <div className="sm:col-span-2 md:col-span-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 mb-2 shadow-sm w-full">
            <label className="text-sm font-black text-emerald-900 uppercase tracking-widest flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">📍 Active Vault Location</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-1 rounded-md font-bold">REQUIRED FOR BATCH SCAN</span>
            </label>
            <input 
              type="text" 
              name="location" 
              required // Forces the user to fill this before saving
              value={formData.location} 
              onChange={handleInputChange} 
              className="w-full border border-emerald-300 rounded-lg px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 bg-white placeholder:font-normal placeholder:text-gray-400" 
              placeholder="e.g. Crate 1, Bin A, New Arrivals..." 
            />
            <p className="text-xs text-emerald-700 mt-2 font-semibold">Set this once. It stays locked while you scan records into this bin.</p>
          </div>

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
            <input type="number" name="price" step="0.01" required value={formData.price} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="0" />
          </div>

          {/* Location has been removed from this bottom row to avoid duplicates */}
          <div className="sm:col-span-2 md:col-span-4 grid grid-cols-2 gap-3 w-full items-end">
            <div className="col-span-1 min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
              <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="180" />
            </div>
            <div className="col-span-1 min-w-0">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
              <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleInputChange} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="1" />
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

      <section className="mb-12 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Items List</h2>
            <p className="text-xs text-gray-500 mt-0.5">Showing {filteredInventory.length} of {inventory.length} total records</p>
          </div>
          
          <div className="w-full sm:w-64 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search local vault..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500 animate-pulse">Loading vault data...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-medium">No records found matching your search.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 flex flex-col w-full">
            {filteredInventory.map((album) => (
              <div key={album.id} className="p-3 sm:p-4 flex gap-3 sm:gap-4 items-center hover:bg-emerald-50 transition group">
                
                {album.cover_image ? (
                  <img src={album.cover_image} alt="cover" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded shadow-sm flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 border border-gray-200">
                    <span className="text-sm opacity-40">💿</span>
                  </div>
                )}
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-end mb-0.5">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate pr-2">{album.title}</h3>
                    <span className="font-bold text-emerald-600 text-sm sm:text-base flex-shrink-0">${(album.price_cents / 100).toFixed(2)}</span>
                  </div>
                  
                  <p className="text-gray-500 text-xs font-medium truncate mb-1.5">{album.artist}</p>
                  
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {album.location ? (
                       <span className="inline-flex items-center bg-gray-900 text-white text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold">
                         📍 {album.location}
                       </span>
                    ) : (
                       <span className="inline-flex items-center bg-red-50 text-red-600 border border-red-100 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold">
                         Unassigned
                       </span>
                    )}
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">{album.weight_grams}g</span>
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">x{album.quantity || 1}</span>
                  </div>
                </div>

                <div className="flex-shrink-0 pl-2">
                   <button 
                     onClick={() => openEditModal(album)} 
                     className="text-gray-400 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-100 border border-gray-200 rounded p-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
                     aria-label="Edit item"
                   >
                     ✏️
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <button 
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 z-10 bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow hover:bg-gray-700 transition"
            >
              ✕
            </button>
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-center">
              <h3 className="font-bold text-gray-900">Scan Barcode</h3>
              <p className="text-xs text-gray-500">Center the barcode in the camera view</p>
            </div>
            
            <BarcodeScanner 
              onDetected={(code: string) => {
                setBarcode(code);
                setShowScanner(false);
              }}
            />
          </div>
        </div>
      )}

    </main>
  );
}
