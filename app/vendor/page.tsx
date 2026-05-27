"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase"; 
import { searchDiscogsByBarcode, searchDiscogsByCatalogNumber, searchDiscogsByText, getDiscogsReleaseDetails } from "../services/discogsService";
import BarcodeScanner from "../components/BarcodeScanner";
import CatalogScanner from "../components/CatalogScanner";

interface InventoryItem {
  id: number;
  artist: string;
  title: string;
  weight_grams: number;
  price_cents: number;
  market_price_cents?: number; 
  status?: string;
  quantity?: number;
  location?: string;
  year?: string;
  genres?: string[];
  tracklist?: any[];
  identifiers?: any[];
  cover_image?: string;
}

const initialFormState = {
  title: "",
  artist: "",
  price: "0", 
  market_price: "", 
  weight: "120",
  quantity: "1",
  location: "",
  cover_image: "", 
  tracklist: [] as any[],
  identifiers: [] as any[]
};

export default function VendorDashboard() {
  // --- NEW AUTH STATES ---
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState(initialFormState); 
  const [barcode, setBarcode] = useState("");
  const [catalog, setCatalog] = useState(""); 
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [autoSave, setAutoSave] = useState(true); 
  const [localSearch, setLocalSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [sortBy, setSortBy] = useState<'date' | 'artist'>('date');
  const [showCatalogScanner, setShowCatalogScanner] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [editFormData, setEditFormData] = useState(initialFormState);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);

  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [isSearchingText, setIsSearchingText] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // --- AUTH & FETCH EFFECT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
      if (session) {
        fetchInventory(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchInventory(session.user.id);
      } else {
        setInventory([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchInventory(vendorId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("id, artist, title, weight_grams, price_cents, market_price_cents, quantity, location, year, genres, tracklist, identifiers, cover_image")
      .eq("vendor_id", vendorId) // SECURE VENDOR FILTER
      .order("id", { ascending: false });

    if (error) console.error("Error fetching inventory:", error);
    else setInventory(data || []);
    setLoading(false);
  }

  const executeSave = async (dataToSave: typeof initialFormState) => {
    setIsUpdating(true);
    setLookupError("");

    const payload = {
      vendor_id: session.user.id, // REAL VENDOR ID
      title: dataToSave.title,
      artist: dataToSave.artist,
      price_cents: Math.round(parseFloat(dataToSave.price || "0") * 100),
      market_price_cents: Math.round(parseFloat(dataToSave.market_price || "0") * 100), 
      weight_grams: parseInt(dataToSave.weight) || 120,
      quantity: parseInt(dataToSave.quantity) || 1,
      location: dataToSave.location,
      cover_image: dataToSave.cover_image, 
      tracklist: dataToSave.tracklist,
      identifiers: dataToSave.identifiers
    };

    const { data: existingMatches } = await supabase
      .from("inventory")
      .select("id")
      .eq("title", payload.title)
      .eq("artist", payload.artist)
      .eq("vendor_id", session.user.id)
      .limit(1);

    if (existingMatches && existingMatches.length > 0) {
      const { error } = await supabase
        .from("inventory")
        .update({ 
          location: payload.location, 
          cover_image: payload.cover_image,
          market_price_cents: payload.market_price_cents,
          tracklist: payload.tracklist,
          identifiers: payload.identifiers,
          weight_grams: payload.weight_grams
        }) 
        .eq("id", existingMatches[0].id);

      if (error) setLookupError(error.message);
      else {
        setFormData({ ...initialFormState, location: dataToSave.location });
        setBarcode("");
        fetchInventory(session.user.id);
      }
    } else {
      const { error } = await supabase.from("inventory").insert([payload]);
      if (error) setLookupError(error.message);
      else {
        setFormData({ ...initialFormState, location: dataToSave.location });
        setBarcode("");
        fetchInventory(session.user.id);
      }
    }
    setIsUpdating(false);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    if (itemToEdit) {
      const payload = {
        title: editFormData.title,
        artist: editFormData.artist,
        price_cents: Math.round(parseFloat(editFormData.price || "0") * 100),
        market_price_cents: Math.round(parseFloat(editFormData.market_price || "0") * 100),
        weight_grams: parseInt(editFormData.weight) || 120,
        quantity: parseInt(editFormData.quantity) || 1,
        location: editFormData.location,
        cover_image: editFormData.cover_image,
      };

      const { error } = await supabase.from("inventory").update(payload).eq("id", itemToEdit.id);
      
      if (error) alert("Error updating record: " + error.message);
      else {
        setIsModalOpen(false);
        setItemToEdit(null);
        fetchInventory(session.user.id);
      }
      setIsUpdating(false);
    } else {
      await executeSave(editFormData);
      setIsModalOpen(false);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this record from your vault?");
    if (!confirmDelete) return;

    setIsUpdating(true);
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    
    if (error) alert("Error deleting record: " + error.message);
    else {
      setIsModalOpen(false);
      setItemToEdit(null);
      fetchInventory(session.user.id); 
    }
    setIsUpdating(false);
  };

  function openEditModal(e: React.MouseEvent, album: InventoryItem) {
    e.stopPropagation(); 
    setItemToEdit(album);
    setEditFormData({
      title: album.title,
      artist: album.artist,
      price: (album.price_cents / 100).toFixed(2),
      market_price: album.market_price_cents ? (album.market_price_cents / 100).toFixed(2) : "",
      weight: album.weight_grams.toString(),
      quantity: (album.quantity || 1).toString(),
      location: album.location || "",
      cover_image: album.cover_image || "", 
      tracklist: album.tracklist || [],
      identifiers: album.identifiers || []
    });
    setIsModalOpen(true);
  }

  function openManualAddModal() {
    setItemToEdit(null);
    setEditFormData({ ...initialFormState, location: formData.location });
    setIsModalOpen(true);
  }

  const handlePipelineRouting = async (newRecordData: typeof initialFormState) => {
    if (autoSave && newRecordData.location) {
      await executeSave(newRecordData);
    } else {
      setItemToEdit(null);
      setEditFormData(newRecordData);
      setIsModalOpen(true);
      if (!newRecordData.location) setLookupError("Auto-save paused: Please set a location first.");
    }
  };

  const processBarcodeLookup = async (code: string) => {
    if (!code) return;
    setIsSearchingDiscogs(true);
    setLookupError("");
    
    const result = await searchDiscogsByBarcode(code);
    
    if (result?.success) {
      const newRecordData = {
        ...formData,
        artist: result.artist,
        title: result.title,
        price: "0",
        market_price: result.market_price ? parseFloat(result.market_price).toFixed(2) : "",
        weight: result.weight || "120",
        quantity: "1",
        location: formData.location,
        cover_image: result.cover_image || "",
        tracklist: result.tracklist || [],
        identifiers: result.identifiers || []
      };
      await handlePipelineRouting(newRecordData);
    } else {
      setLookupError(result?.error || "Barcode lookup failed.");
    }
    setIsSearchingDiscogs(false);
  };

  const handleCatalogLookup = async (catno: string) => {
    if (!catno) return;
    setIsSearchingDiscogs(true);
    setLookupError("");
    
    const result = await searchDiscogsByCatalogNumber(catno);
    
    if (result?.success) {
      const newRecordData = {
        ...formData,
        artist: result.artist,
        title: result.title,
        price: "0",
        market_price: result.market_price ? parseFloat(result.market_price).toFixed(2) : "",
        weight: result.weight || "120",
        quantity: "1",
        location: formData.location,
        cover_image: result.cover_image || "",
        tracklist: result.tracklist || [],
        identifiers: result.identifiers || []
      };
      await handlePipelineRouting(newRecordData);
      setCatalog(""); 
    } else {
      setLookupError(result?.error || "Catalog lookup failed.");
    }
    setIsSearchingDiscogs(false);
  };

  const handleRematchRelease = async (item: InventoryItem) => {
    setViewItem(null);
    setTextQuery(`${item.artist} ${item.title}`);
    setIsSearchingText(true);
    try {
      const response = await searchDiscogsByText(`${item.artist} ${item.title}`);
      if (response && response.success && response.results) {
        setSearchResults(response.results);
      }
    } catch (err) {
      setLookupError("Failed to re-match.");
    }
    setIsSearchingText(false);
  };

  const handleSelectRelease = async (id: number) => {
    setIsSearchingDiscogs(true);
    const result = await getDiscogsReleaseDetails(id);

    if (result?.success) {
      const descriptionsString = result.formats?.[0]?.descriptions?.join(" ") || "";
      let detectedWeight = 120; 

      if (descriptionsString.includes("200g")) {
        detectedWeight = 200;
      } else if (descriptionsString.includes("180g")) {
        detectedWeight = 180;
      } else if (result.weight) {
        detectedWeight = parseInt(result.weight);
      }

      if (viewItem) {
        const { error } = await supabase.from("inventory").update({
          title: result.title,
          artist: result.artist,
          cover_image: result.cover_image,
          tracklist: result.tracklist,
          identifiers: result.identifiers,
          market_price_cents: result.market_price ? Math.round(parseFloat(result.market_price) * 100) : 0,
          weight_grams: detectedWeight
        }).eq("id", viewItem.id);
        
        if (!error) fetchInventory(session.user.id);
      } else {
        const newRecordData = {
          ...formData,
          artist: result.artist,
          title: result.title,
          price: "0",
          market_price: result.market_price ? parseFloat(result.market_price).toFixed(2) : "",
          weight: detectedWeight.toString(),
          quantity: "1",
          location: formData.location,
          cover_image: result.cover_image || "",
          tracklist: result.tracklist || [],
          identifiers: result.identifiers || []
        };
        await handlePipelineRouting(newRecordData);
      }
    } else {
      alert(result?.error || "Failed to fetch album details.");
    }
    
    setSearchResults([]); 
    setIsSearchingDiscogs(false); 
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true; 

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setTextQuery(transcript); 
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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

  const uniqueLocations = Array.from(new Set(inventory.map(item => item.location || "").filter(Boolean))).sort();

  const categoryInventory = selectedCategory 
    ? inventory.filter(item => item.location === selectedCategory) 
    : inventory;

  const sortedInventory = [...categoryInventory].sort((a, b) => {
    if (sortBy === 'artist') {
      return a.artist.localeCompare(b.artist);
    }
    return b.id - a.id; 
  });

  const filteredInventory = sortedInventory.filter((album) => {
    const searchLower = localSearch.toLowerCase();
    return !localSearch || 
      album.title.toLowerCase().includes(searchLower) ||
      album.artist.toLowerCase().includes(searchLower) ||
      (album.location && album.location.toLowerCase().includes(searchLower)) ||
      (album.tracklist && Array.isArray(album.tracklist) && album.tracklist.some((track: any) => track.title && track.title.toLowerCase().includes(searchLower)));
  });

  // --- SECURITY GUARDS ---
  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Unlocking Vault...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-500 mb-6">You must be logged in to access the Vendor Vault.</p>
        <a href="/login" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition">Go to Login</a>
      </div>
    );
  }

  return (
    <main className="p-4 sm:p-8 w-full max-w-full overflow-x-hidden mx-auto font-sans relative animate-fade-in pb-20">
      
      {/* --- HIDDEN DATALIST FOR LOCATION AUTOCOMPLETE --- */}
      <datalist id="location-options">
        {uniqueLocations.map(loc => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      {/* --- HEADER --- */}
      <header className="border-b border-gray-200 pb-5 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-5 w-full">
        <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
          <div className="w-12 h-12 flex-shrink-0">
            <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-full h-full object-contain rounded-lg shadow-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight truncate">TimbreBox</h1>
            <p className="text-emerald-600 text-sm mt-1 font-semibold truncate">Vault Unlocked • {session?.user?.email}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full md:w-auto">
          <a href="/vendor/settings" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">⚙️ Settings</a>
          <a href="/" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">View Radar</a>
          <button onClick={() => supabase.auth.signOut()} className="text-sm font-semibold text-red-500 hover:text-white transition border border-red-200 hover:bg-red-500 px-4 py-2 rounded-lg flex-1 text-center whitespace-nowrap">Sign Out</button>
        </div>
      </header>

      {/* --- STREAMLINED SCANNING STATION --- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 w-full max-w-full overflow-hidden mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Rapid Insertion Station</h2>
          <button 
            onClick={openManualAddModal}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
          >
            ✍️ Add Manually
          </button>
        </div>
        
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-4 items-end w-full">
          
          <div className="sm:col-span-2 md:col-span-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 mb-2 shadow-sm w-full">
            <label className="text-sm font-black text-emerald-900 uppercase tracking-widest flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">📍 Active Vault Location</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-1 rounded-md font-bold">REQUIRED FOR BATCH SCAN</span>
            </label>
            <div className="relative w-full">
              <input 
                type="text" 
                name="location" 
                list="location-options"
                value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                className="w-full border border-emerald-300 rounded-lg pl-4 pr-12 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 bg-white placeholder:font-normal placeholder:text-gray-400" 
                placeholder="e.g. Crate 1, Bin A, New Arrivals..." 
              />
            </div>
          </div>

          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2 w-full min-w-0 overflow-hidden">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Barcode Lookup</span>
              <span className="text-emerald-600 font-medium">Powered by Discogs</span>
            </label>
            <div className="flex gap-2 mt-1.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input 
                  type="text" 
                  placeholder={!formData.location ? "Set location first..." : "Type UPC barcode here and press Enter..."} 
                  value={barcode} 
                  disabled={!formData.location || isSearchingDiscogs}
                  onChange={(e) => setBarcode(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); processBarcodeLookup(barcode); } }}
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" 
                />
                {barcode && (
                  <button 
                    type="button" 
                    onClick={() => setBarcode("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >✕</button>
                )}
              </div>
              <button 
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={!formData.location || isSearchingDiscogs}
                className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
              >
                {isSearchingDiscogs ? '⏳ ...' : '📷 Scan'}
              </button>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <input 
                type="checkbox" 
                id="autoSaveToggle"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-white border-gray-300 rounded focus:ring-emerald-500 focus:ring-2"
              />
              <label htmlFor="autoSaveToggle" className="text-sm font-semibold text-gray-700 cursor-pointer">
                Auto-Save on successful scan <span className="text-gray-400 font-normal">(Ignores manual review)</span>
              </label>
            </div>
          </div>

          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2 w-full min-w-0 overflow-hidden">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Catalog Number Lookup</span>
              <span className="text-emerald-600 font-medium">Fast Manual Search</span>
            </label>
            <div className="flex gap-2 mt-1.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input 
                  type="text" 
                  placeholder={!formData.location ? "Set location first..." : "e.g. FC 37152 and press Enter..."} 
                  value={catalog} 
                  disabled={!formData.location || isSearchingDiscogs}
                  onChange={(e) => setCatalog(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCatalogLookup(catalog); } }}
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" 
                />
                {catalog && (
                  <button 
                    type="button" 
                    onClick={() => setCatalog("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >✕</button>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setShowCatalogScanner(true)}
                disabled={!formData.location || isSearchingDiscogs}
                className="flex-shrink-0 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg px-3 py-2 text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                📷 OCR
              </button>
              <button 
                type="button" 
                onClick={() => handleCatalogLookup(catalog)}
                disabled={!formData.location || isSearchingDiscogs || !catalog}
                className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
              >
                {isSearchingDiscogs ? '⏳' : 'Search'}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2 w-full min-w-0 overflow-hidden">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Text Search</span>
              <span className="text-emerald-600 font-medium">Top 20 Matches</span>
            </label>
            <div className="flex gap-2 mt-1.5 w-full">
              <div className="relative flex-1 min-w-0">
                <input 
                  type="text" 
                  placeholder={!formData.location ? "Set location first..." : "e.g. Pink Floyd Dark Side"} 
                  value={textQuery} 
                  disabled={!formData.location || isSearchingText}
                  onChange={(e) => setTextQuery(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTextSearch(e); }}
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-16 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed" 
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {textQuery && (
                    <button 
                      type="button" 
                      onClick={() => setTextQuery("")}
                      className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1"
                    >✕</button>
                  )}
                  <button 
                    type="button" 
                    onClick={startVoiceSearch}
                    disabled={!formData.location || isSearchingText}
                    className={`p-1.5 rounded-md transition disabled:opacity-50 flex items-center justify-center ${
                      isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-gray-400 hover:text-emerald-600 bg-gray-50'
                    }`}
                    title="Voice Search"
                  >
                    🎤
                  </button>
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleTextSearch}
                disabled={!formData.location || isSearchingText || !textQuery}
                className="flex-shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 sm:px-6 py-2 text-sm font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {res.year || 'Unknown Year'} • {res.country || 'Unknown Region'}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {res.label?.[0] || 'Unknown Label'} {res.catno ? `(${res.catno})` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lookupError && (
            <div className="sm:col-span-2 md:col-span-4 text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 w-full break-words">
              {lookupError}
            </div>
          )}

        </div>
      </section>

      {/* --- DYNAMIC CATEGORY FILTER BAR --- */}
      <section className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
              !selectedCategory ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Items
          </button>
          {uniqueLocations.map(loc => (
            <button 
              key={loc}
              onClick={() => setSelectedCategory(loc === selectedCategory ? null : loc)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition ${
                selectedCategory === loc ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </section>

      {/* --- SORTING CONTROLS --- */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setSortBy('date')} 
          className={`px-3 py-1 text-xs font-bold rounded-lg transition ${sortBy === 'date' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Sort: Newest
        </button>
        <button 
          onClick={() => setSortBy('artist')} 
          className={`px-3 py-1 text-xs font-bold rounded-lg transition ${sortBy === 'artist' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Sort: Artist A-Z
        </button>
      </div>

      {/* --- INVENTORY LIST --- */}
      <section className="mb-12 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Items List</h2>
            <p className="text-xs text-gray-500 mt-0.5">Showing {filteredInventory.length} of {categoryInventory.length} total records</p>
          </div>
          
          <div className="w-full sm:w-64 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search local vault..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            {localSearch && (
              <button 
                type="button" 
                onClick={() => setLocalSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs"
              >✕</button>
            )}
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
              <div 
                key={album.id} 
                onClick={() => setViewItem(album)} 
                className="p-3 sm:p-4 flex gap-3 sm:gap-4 items-center hover:bg-emerald-50 transition group cursor-pointer"
              >
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
                    <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">QTY: {album.quantity || 1}</span>
                    
                    {album.market_price_cents && album.market_price_cents > 0 && (
                      <span className="inline-block bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                        Market: ${(album.market_price_cents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 pl-2">
                   <button 
                     onClick={(e) => openEditModal(e, album)} 
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

      {/* --- DETAILS VIEW MODAL --- */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50">
              <div className="flex gap-4 items-center">
                {viewItem.cover_image ? (
                  <img src={viewItem.cover_image} alt="cover" className="w-16 h-16 object-cover rounded shadow-sm" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-2xl">💿</div>
                )}
                <div>
                  <h3 className="font-bold text-gray-900 text-xl leading-tight">{viewItem.title}</h3>
                  <p className="text-sm text-gray-500 font-medium">{viewItem.artist}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewItem(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition"
              >✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              
              <div className="flex gap-4">
                <button 
                  onClick={() => handleRematchRelease(viewItem)}
                  className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                >
                  🔄 Re-match Release
                </button>
              </div>

              <div className="flex gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex-1">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Your Price</p>
                  <p className="text-2xl font-black text-emerald-600">${(viewItem.price_cents / 100).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex-1">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Market Est.</p>
                  <p className="text-2xl font-black text-blue-600">
                    {viewItem.market_price_cents ? `$${(viewItem.market_price_cents / 100).toFixed(2)}` : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 flex-1 flex flex-col justify-center items-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</p>
                  <p className="text-lg font-bold text-gray-900">{viewItem.location || 'Unassigned'}</p>
                </div>
              </div>

              {viewItem.tracklist && viewItem.tracklist.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1">Tracklist</h4>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-1">
                    {viewItem.tracklist.map((track: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-100 transition">
                        <div className="flex gap-3">
                          <span className="text-xs font-bold text-gray-400 w-4">{track.position || i+1}</span>
                          <span className="text-sm font-semibold text-gray-800">{track.title}</span>
                        </div>
                        <span className="text-xs text-gray-500">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewItem.identifiers && viewItem.identifiers.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 border-b border-gray-100 pb-1">Identifiers & Matrix Info</h4>
                  <ul className="text-sm text-gray-600 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {viewItem.identifiers.map((id: any, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-bold min-w-[100px]">{id.type}:</span>
                        <span className="font-mono text-xs bg-white px-1 border border-gray-100 rounded">{id.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- UNIVERSAL RECORD MODAL (Add & Edit) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {itemToEdit ? "Edit Inventory Record" : "Review & Add Record"}
              </h3>
              <button 
                onClick={() => { setIsModalOpen(false); setItemToEdit(null); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition"
              >✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="recordForm" onSubmit={handleModalSubmit} className="flex flex-col gap-4">
                
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title <span className="text-red-500">*</span></label>
                  <div className="relative w-full">
                    <input type="text" name="title" required value={editFormData.title} onChange={(e) => setEditFormData({...editFormData, title: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    {editFormData.title && (
                      <button type="button" onClick={() => setEditFormData({...editFormData, title: ""})} className="absolute right-3 top-1/2 translate-y-[1px] text-gray-400 hover:text-gray-600 font-bold text-xs">✕</button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist <span className="text-red-500">*</span></label>
                  <div className="relative w-full">
                    <input type="text" name="artist" required value={editFormData.artist} onChange={(e) => setEditFormData({...editFormData, artist: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    {editFormData.artist && (
                      <button type="button" onClick={() => setEditFormData({...editFormData, artist: ""})} className="absolute right-3 top-1/2 translate-y-[1px] text-gray-400 hover:text-gray-600 font-bold text-xs">✕</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Your Price ($) <span className="text-red-500">*</span></label>
                    <input type="number" name="price" step="0.01" required value={editFormData.price} onChange={(e) => setEditFormData({...editFormData, price: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider pl-1">Discogs Lowest ($)</label>
                    <input type="number" name="market_price" readOnly value={editFormData.market_price} className="w-full mt-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="N/A" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
                    <input type="number" name="weight" value={editFormData.weight} onChange={(e) => setEditFormData({...editFormData, weight: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
                    <input type="number" name="quantity" min="1" value={editFormData.quantity} onChange={(e) => setEditFormData({...editFormData, quantity: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                </div>

                {/* --- DYNAMIC LOCATION COMBOBOX --- */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Location</label>
                  <div className="w-full">
                    <input 
                      type="text" 
                      name="location" 
                      list="location-options" 
                      value={editFormData.location} 
                      onChange={(e) => setEditFormData({...editFormData, location: e.target.value})} 
                      className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                      placeholder="Select or type a location..."
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-2 sm:gap-3">
              {itemToEdit && (
                <button 
                  type="button" 
                  onClick={() => handleDeleteRecord(itemToEdit.id)}
                  disabled={isUpdating}
                  className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl px-4 py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 flex items-center justify-center"
                >
                  🗑️
                </button>
              )}
              <button 
                type="button" 
                onClick={() => { setIsModalOpen(false); setItemToEdit(null); }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl py-3.5 text-sm font-bold transition shadow-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="recordForm"
                disabled={isUpdating} 
                className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : (itemToEdit ? 'Update' : 'Save')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- BARCODE SCANNER MODAL --- */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <button 
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 z-10 bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow hover:bg-gray-700 transition"
            >✕</button>
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-center">
              <h3 className="font-bold text-gray-900">Scan Barcode</h3>
              <p className="text-xs text-gray-500">Center the barcode in the camera view</p>
            </div>
            
            <BarcodeScanner 
              onDetected={async (code: string) => {
                setBarcode(code);
                setShowScanner(false);
                await processBarcodeLookup(code);
              }}
            />
          </div>
        </div>
      )}

      {/* --- CATALOG OCR SCANNER MODAL --- */}
      {showCatalogScanner && (
        <CatalogScanner 
          onClose={() => setShowCatalogScanner(false)}
          onDetected={async (text: string) => {
            setCatalog(text); 
            setShowCatalogScanner(false); 
            await handleCatalogLookup(text); 
          }}
        />
      )}

    </main>
  );
}
