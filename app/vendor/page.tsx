"use client";

import { useRouter } from 'next/navigation'; 
import { useState, useEffect } from "react";
import { supabase } from "../supabase"; 
import { 
  searchDiscogsByBarcode, 
  searchDiscogsByCatalogNumber, 
  searchDiscogsByText, 
  getDiscogsReleaseDetails,
  fetchLiveCacheMetrics
} from "../services/discogsService";
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
  condition: "VG+";
  year?: string;
  genres?: string[];
  tracklist?: any[];
  identifiers?: any[];
  cover_image?: string;
}

interface BuyerLead {
  id: string;
  record_id: number;
  vendor_id: string;
  guest_email: string;
  status: string;
  created_at: string;
  inventory: {
    title: string;
    artist: string;
    cover_image: string;
    price_cents: number;
  };
}

const initialFormState = {
  title: "",
  artist: "",
  price: "0", 
  market_price: "", 
  weight: "120",
  quantity: "1",
  location: "",
  condition: "VG+",
  cover_image: "", 
  tracklist: [] as any[],
  identifiers: [] as any[]
};

export default function VendorDashboard() {
  // --- AUTH STATES ---
  const [session, setSession] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [storeName, setStoreName] = useState("Your Store");
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- INBOX STATES ---
  const [leads, setLeads] = useState<BuyerLead[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

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

  // --- GALLERY STATES ---
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("Dead Wax / Matrix");

  // --- UI STATES ---
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scanTab, setScanTab] = useState<'barcode' | 'catalog' | 'text'>('barcode');

  // --- LAZY LOADING PREVIEW STATES ---
  const [previewReleaseId, setPreviewReleaseId] = useState<number | null>(null);
  const [previewDetails, setPreviewDetails] = useState<any | null>(null);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);

  // --- TELEMETRY METRICS STATES ---
  const [metrics, setMetrics] = useState({
    total_requests: 0,
    cache_hits: 0,
    api_misses: 0,
    efficiency_pct: 0,
    avg_cache_ms: 0,
    avg_api_ms: 0
  });
  const [showMetrics, setShowMetrics] = useState(false);

  // --- BULK ACTION STATES ---
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // --- AUTH & FETCH EFFECT ---
  useEffect(() => {
    let isMounted = true;

    // 🚨 FAIL-SAFE: If Supabase hangs for more than 3 seconds, force the screen to unlock
    const failsafeTimeout = setTimeout(() => {
      if (isMounted) setIsAuthLoading(false);
    }, 3000);

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      
      clearTimeout(failsafeTimeout); // It worked quickly, cancel the fail-safe
      
      if (error) console.error("Session fetch error:", error);
      
      setSession(session);
      setIsAuthLoading(false); // Unlock the UI
      
      if (session) {
        fetchInventory(session.user.id);
        fetchStoreProfile(session.user.id);
        fetchLeads(session.user.id);
        refreshTelemetry();
      }
    }).catch(err => {
      console.error("Auth initialization failed:", err);
      if (isMounted) setIsAuthLoading(false); // Unlock even on failure
    });

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setIsAuthLoading(false); // Guarantee UI unlocks on any auth event
      
      if (session) {
        fetchInventory(session.user.id);
        fetchStoreProfile(session.user.id);
        fetchLeads(session.user.id);
        refreshTelemetry();
      } else {
        setInventory([]);
        setLeads([]);
        setStoreName("Your Store");
        setIsAdmin(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(failsafeTimeout);
      subscription.unsubscribe();
    };
  }, []);
  
  async function fetchLeads(vendorId: string) {
    const { data, error } = await supabase
      .from("buyer_leads")
      .select("*, inventory(title, artist, cover_image, price_cents)")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data as any[]);
    }
  }

  async function updateLeadStatus(leadId: string, newStatus: string) {
    const { error } = await supabase
      .from('buyer_leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } else {
      alert("Failed to update status.");
    }
  }

  async function refreshTelemetry() {
    const res = await fetchLiveCacheMetrics();
    if (res?.success && res.metrics) {
      setMetrics(res.metrics);
    }
  }

  async function fetchStoreProfile(userId: string) {
    const { data } = await supabase
      .from("vendor_profiles")
      .select("store_name, is_admin")
      .eq("id", userId)
      .single();
    
    if (data) {
      if (data.store_name) setStoreName(data.store_name);
      setIsAdmin(!!data.is_admin);
    }
  }

  async function fetchInventory(vendorId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory")
      .select("id, artist, title, weight_grams, price_cents, market_price_cents, quantity, location, condition, year, genres, tracklist, identifiers, cover_image")
      .eq("vendor_id", vendorId) 
      .order("id", { ascending: false });

    if (error) console.error("Error fetching inventory:", error);
    else setInventory(data || []);
    setLoading(false);
  }

  // --- GALLERY IMAGE FUNCTIONS ---
  async function fetchGalleryImages(recordId: number) {
    const { data } = await supabase
      .from('record_images')
      .select('*')
      .eq('record_id', recordId)
      .order('created_at', { ascending: true });
    
    setGalleryImages(data || []);
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !itemToEdit) return;
    const file = e.target.files[0];
    setIsUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${itemToEdit.id}_${Math.random()}.${fileExt}`;
    const filePath = `${session.user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('record_gallery')
      .upload(filePath, file);

    if (uploadError) {
      alert('Camera upload failed: ' + uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('record_gallery')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('record_images')
      .insert([{
        record_id: itemToEdit.id,
        image_url: publicUrl,
        caption: uploadCaption 
      }]);

    if (dbError) {
      alert('Database link failed: ' + dbError.message);
    } else {
      await fetchGalleryImages(itemToEdit.id); 
    }
    
    setIsUploading(false);
  };

  const handleDeleteImage = async (imageId: string) => {
    const confirmDelete = window.confirm("Delete this photo?");
    if (!confirmDelete) return;

    await supabase.from('record_images').delete().eq('id', imageId);
    setGalleryImages(galleryImages.filter(img => img.id !== imageId));
  };

  const executeSave = async (dataToSave: typeof initialFormState) => {
    setIsUpdating(true);
    setLookupError("");

    const payload = {
      vendor_id: session.user.id, 
      title: dataToSave.title,
      artist: dataToSave.artist,
      price_cents: Math.round(parseFloat(dataToSave.price || "0") * 100),
      market_price_cents: Math.round(parseFloat(dataToSave.market_price || "0") * 100), 
      weight_grams: parseInt(dataToSave.weight) || 120,
      quantity: parseInt(dataToSave.quantity) || 1,
      location: dataToSave.location,
      condition: dataToSave.condition,
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
        await refreshTelemetry();
      }
    } else {
      const { error } = await supabase.from("inventory").insert([payload]);
      if (error) setLookupError(error.message);
      else {
        setFormData({ ...initialFormState, location: dataToSave.location });
        setBarcode("");
        fetchInventory(session.user.id);
        await refreshTelemetry();
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
        condition: editFormData.condition,
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
    const confirmDelete = window.confirm("Are you sure you want to permanently delete this record from your collection?");
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
    setGalleryImages([]); 
    fetchGalleryImages(album.id); 

    setEditFormData({
      title: album.title,
      artist: album.artist,
      price: (album.price_cents / 100).toFixed(2),
      market_price: album.market_price_cents ? (album.market_price_cents / 100).toFixed(2) : "",
      weight: album.weight_grams.toString(),
      quantity: (album.quantity || 1).toString(),
      location: album.location || "",
      condition: album.condition || "VG+",
      cover_image: album.cover_image || "", 
      tracklist: album.tracklist || [],
      identifiers: album.identifiers || []
    });
    setIsModalOpen(true);
  }

  function openManualAddModal() {
    setItemToEdit(null);
    setGalleryImages([]);
    setEditFormData({ ...initialFormState, location: formData.location });
    setIsScannerModalOpen(false);
    setIsModalOpen(true);
  }

  const handlePipelineRouting = async (newRecordData: typeof initialFormState) => {
    if (autoSave && newRecordData.location) {
      await executeSave(newRecordData);
    } else {
      setItemToEdit(null);
      setEditFormData(newRecordData);
      setIsScannerModalOpen(false);
      setIsModalOpen(true);
      if (!newRecordData.location) setLookupError("Auto-save paused: Please set a location first.");
    }
  };

  const processBarcodeLookup = async (code: string) => {
    if (!code) return;
    setIsSearchingDiscogs(true);
    setLookupError("");
    
    const result = await searchDiscogsByBarcode(code, session?.user?.id);
    
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
      await refreshTelemetry();
    }
    setIsSearchingDiscogs(false);
  };

  const handleCatalogLookup = async (catno: string) => {
    if (!catno) return;
    setIsSearchingDiscogs(true);
    setLookupError("");
    
    const result = await searchDiscogsByCatalogNumber(catno, session?.user?.id);
    
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
      await refreshTelemetry();
    }
    setIsSearchingDiscogs(false);
  };

  const handleRematchRelease = async (item: InventoryItem) => {
    setViewItem(null);
    setFormData(prev => ({ ...prev, location: item.location || "" }));
    textQuery ? void 0 : setTextQuery(`${item.artist} ${item.title}`);
    setIsScannerModalOpen(true);
    setScanTab('text');
    setIsSearchingText(true);
    
    try {
      const response = await searchDiscogsByText(`${item.artist} ${item.title}`, session?.user?.id);
      if (response && response.success && response.results) {
        setSearchResults(response.results);
      }
    } catch (err) {
      setLookupError("Failed to re-match.");
    } finally {
      await refreshTelemetry();
    }
    setIsSearchingText(false);
  };

  const handleTogglePreview = async (releaseId: number) => {
    if (!formData.location.trim()) {
      return; 
    }

    if (previewReleaseId === releaseId) {
      setPreviewReleaseId(null);
      setPreviewDetails(null);
      return;
    }

    setPreviewReleaseId(releaseId);
    setPreviewDetails(null);
    setIsFetchingPreview(true);

    const result = await getDiscogsReleaseDetails(releaseId, session?.user?.id);
    if (result?.success) {
      setPreviewDetails(result);
    } else {
      alert("Could not fetch preview: " + (result?.error || "Unknown Error"));
      setPreviewReleaseId(null);
      await refreshTelemetry();
    }
    setIsFetchingPreview(false);
  };

  const handleSelectFromPreview = async () => {
    if (!previewDetails) return;

    const descriptionsString = previewDetails.formats?.[0]?.descriptions?.join(" ") || "";
    let detectedWeight = 120; 

    if (descriptionsString.includes("200g")) detectedWeight = 200;
    else if (descriptionsString.includes("180g")) detectedWeight = 180;
    else if (previewDetails.weight) detectedWeight = parseInt(previewDetails.weight);

    if (viewItem) {
      const { error } = await supabase.from("inventory").update({
        title: previewDetails.title,
        artist: previewDetails.artist,
        cover_image: previewDetails.cover_image,
        tracklist: previewDetails.tracklist,
        identifiers: previewDetails.identifiers,
        market_price_cents: previewDetails.market_price ? Math.round(parseFloat(previewDetails.market_price) * 100) : 0,
        weight_grams: detectedWeight
      }).eq("id", viewItem.id);
      
      if (!error) {
        fetchInventory(session.user.id);
        setIsScannerModalOpen(false);
        setPreviewReleaseId(null);
        setPreviewDetails(null);
        setSearchResults([]);
        await refreshTelemetry();
      }
    } else {
      const newRecordData = {
        ...formData, 
        artist: previewDetails.artist,
        title: previewDetails.title,
        price: "0",
        market_price: previewDetails.market_price ? parseFloat(previewDetails.market_price).toFixed(2) : "",
        weight: detectedWeight.toString(),
        quantity: "1",
        cover_image: previewDetails.cover_image || "",
        tracklist: previewDetails.tracklist || [],
        identifiers: previewDetails.identifiers || []
      };
      
      await executeSave(newRecordData); 
      
      setIsScannerModalOpen(false);
      setPreviewReleaseId(null);
      setPreviewDetails(null);
      setSearchResults([]);
      await refreshTelemetry();
    }
  };

  const startVoiceSearch = (targetTab: 'text' | 'catalog') => {
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
      
      if (targetTab === 'text') {
        setTextQuery(transcript); 
      } else if (targetTab === 'catalog') {
        setCatalog(transcript.toUpperCase());
      }
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
    setSearchResults([]);
    setPreviewReleaseId(null);
    setPreviewDetails(null);
    
    try {
      const response = await searchDiscogsByText(textQuery, session?.user?.id); 
      if (response && response.success && response.results && response.results.length > 0) {
        setSearchResults(response.results);
      } else {
        setLookupError(response?.error || "No results found for that search.");
      }
    } catch (err) {
      console.error("Text search failed:", err);
      setLookupError("Search failed. Check your API connection.");
    } finally {
      await refreshTelemetry();
    }
    
    setIsSearchingText(false);
  };

  // --- BULK ACTION HELPERS ---
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => 
      prev.length === filteredInventory.length ? [] : filteredInventory.map(i => i.id)
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Permanently delete ${selectedIds.length} records from your vault?`)) return;
    setIsUpdating(true);
    const { error } = await supabase.from('inventory').delete().in('id', selectedIds);
    
    if (error) {
      alert("Error processing bulk deletion: " + error.message);
    } else {
      setSelectedIds([]);
      fetchInventory(session.user.id);
    }
    setIsUpdating(false);
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

  // Calculate unread leads
  const unreadLeadsCount = leads.filter(l => l.status === 'new').length;

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">Unlocking Account...</div>;
  }

  const router = useRouter();

  if (!session && !isAuthLoading) {
    router.push('/login');
    return null; 
  }

  return (
    <main className="p-4 sm:p-8 w-full max-w-full overflow-x-hidden mx-auto font-sans relative animate-fade-in pb-20">
      
      <datalist id="location-options">
        {uniqueLocations.map(loc => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      {/* --- HEADER --- */}
      <header className="flex justify-between items-center w-full mb-8 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0">
            <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-full h-full object-contain rounded-lg shadow-sm" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">TimbreBox</h1>
            <p className="text-emerald-600 text-xs font-semibold mt-1 truncate">{storeName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative z-30">
          
          {/* INBOX BUTTON */}
          <button 
            onClick={() => setIsInboxOpen(true)}
            className="relative w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-full flex items-center justify-center text-lg transition shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            📨
            {unreadLeadsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                {unreadLeadsCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-10 h-10 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full flex items-center justify-center text-lg transition shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            👤
          </button>
          
          {isProfileMenuOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setIsProfileMenuOpen(false)}></div>
              <div className="absolute right-0 mt-12 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden animate-fade-in">
                <a href="/vendor/settings" className="px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b border-gray-50 transition flex items-center gap-2">⚙️ Settings</a>
                {isAdmin && (
                  <a href="/admin" className="px-5 py-3.5 text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border-b border-gray-50 transition flex items-center gap-2">🛡️ Admin Panel</a>
                )}
                <a href="/" className="px-5 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b border-gray-50 transition flex items-center gap-2">📡 View Radar</a>
                <button onClick={() => supabase.auth.signOut()} className="px-5 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 text-left transition flex items-center gap-2">🚪 Sign Out</button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* --- BUYER LEADS INBOX MODAL --- */}
      {isInboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">📨</span>
                <h3 className="font-black text-gray-900 text-lg tracking-tight">Buyer Requests</h3>
              </div>
              <button onClick={() => setIsInboxOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
            </div>
            
            <div className="p-0 overflow-y-auto bg-gray-50 flex-1">
              {leads.length === 0 ? (
                <div className="p-16 text-center text-gray-400 font-medium">
                  <div className="text-4xl mb-3 opacity-30">📭</div>
                  No buyer requests yet. Make sure you have items priced above $0.00 on the radar!
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <div key={lead.id} className={`p-5 flex flex-col sm:flex-row gap-4 transition ${lead.status === 'new' ? 'bg-white' : 'bg-gray-50 opacity-80'}`}>
                      
                      {/* Record Snippet */}
                      <div className="flex gap-3 flex-1 min-w-0">
                        {lead.inventory?.cover_image ? (
                          <img src={lead.inventory.cover_image} alt="cover" className="w-14 h-14 object-cover rounded-lg shadow-sm border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 flex-shrink-0">💿</div>
                        )}
                        <div className="flex flex-col justify-center min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{lead.inventory?.title || "Record Deleted"}</h4>
                          <p className="text-xs text-gray-500 font-medium truncate mb-1">{lead.inventory?.artist || "Unknown"}</p>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded w-fit border border-emerald-100">
                            ${((lead.inventory?.price_cents || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Lead Details & Actions */}
                      <div className="flex flex-col justify-center gap-2 sm:items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                            {lead.guest_email}
                          </span>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(lead.guest_email); alert('Email copied!'); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                          >
                            Copy
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {lead.status === 'new' && (
                            <>
                              <button onClick={() => updateLeadStatus(lead.id, 'contacted')} className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">Mark Contacted</button>
                              <button onClick={() => updateLeadStatus(lead.id, 'resolved')} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition">Mark Sold</button>
                            </>
                          )}
                          {lead.status === 'contacted' && (
                            <button onClick={() => updateLeadStatus(lead.id, 'resolved')} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition">Complete Sale</button>
                          )}
                          {lead.status === 'resolved' && (
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resolved ✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MASTER SCAN/ADD BUTTON --- */}
      <section className="mb-6">
        <button 
          onClick={() => setIsScannerModalOpen(true)}
          className="w-full bg-gray-900 hover:bg-emerald-600 text-white rounded-2xl py-4 shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all duration-300 flex justify-center items-center gap-3 transform active:scale-[0.98]"
        >
          <span className="text-xl">➕</span>
          <span className="font-black text-lg tracking-wide">Add / Scan Records</span>
        </button>
      </section>

      {/* --- DYNAMIC CATEGORY FILTER BAR --- */}
      <section className="mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition flex-shrink-0 ${
              !selectedCategory ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Items
          </button>
          {uniqueLocations.map(loc => (
            <button 
              key={loc}
              onClick={() => setSelectedCategory(loc === selectedCategory ? null : loc)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition flex-shrink-0 ${
                selectedCategory === loc ? 'bg-emerald-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </section>

      {/* --- SORTING CONTROLS --- */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setSortBy('date')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${sortBy === 'date' ? 'bg-gray-200 text-gray-900' : 'bg-transparent text-gray-500 hover:bg-gray-100'}`}>Sort: Newest</button>
        <button onClick={() => setSortBy('artist')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${sortBy === 'artist' ? 'bg-gray-200 text-gray-900' : 'bg-transparent text-gray-500 hover:bg-gray-100'}`}>Sort: Artist A-Z</button>
      </div>

      {/* --- INVENTORY LIST --- */}
      <section className="mb-12 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={filteredInventory.length > 0 && selectedIds.length === filteredInventory.length}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Collection</h2>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Showing {filteredInventory.length} of {categoryInventory.length}</p>
            </div>
          </div>
          
          <div className="w-full sm:w-64 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" placeholder="Search local crates..." value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50 transition"
            />
            {localSearch && (
              <button type="button" onClick={() => setLocalSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 font-bold text-xs">✕</button>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-gray-400 font-bold animate-pulse">Loading collection...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-4xl mb-3 opacity-20">💿</div>
            <p className="text-gray-500 font-bold">No records found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 flex flex-col w-full">
            {filteredInventory.map((album) => (
              <div key={album.id} className="p-3 sm:p-5 flex gap-3 sm:gap-4 items-center hover:bg-emerald-50 transition group">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(album.id)}
                  onChange={() => toggleSelect(album.id)}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                />
                
                <div onClick={() => setViewItem(album)} className="flex-1 flex gap-3 sm:gap-4 items-center cursor-pointer min-w-0">
                  {album.cover_image ? (
                    <img src={album.cover_image} alt="cover" className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200">
                      <span className="text-lg opacity-30">💿</span>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate pr-2">{album.title}</h3>
                      <span className={`text-sm sm:text-base flex-shrink-0 ${album.price_cents > 0 ? 'font-black text-emerald-600' : 'font-medium text-gray-400'}`}>
                        ${(album.price_cents / 100).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium truncate mb-1.5">{album.artist}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {album.location ? (
                         <span className="inline-flex items-center bg-gray-900 text-white text-[9px] sm:text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold">📍 {album.location}</span>
                      ) : (
                         <span className="inline-flex items-center bg-red-50 text-red-600 border border-red-100 text-[9px] sm:text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold">Unassigned</span>
                      )}
                      <span className="inline-block bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{album.weight_grams}g</span>
                      <span className="inline-block bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">QTY: {album.quantity || 1}</span>
                      {album.market_price_cents && album.market_price_cents > 0 ? (
                        <span className="inline-block bg-blue-50 text-blue-700 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Market: ${(album.market_price_cents / 100).toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 pl-2">
                   <button onClick={(e) => openEditModal(e, album)} className="text-gray-300 hover:text-emerald-600 bg-transparent hover:bg-emerald-50 rounded-lg p-2 transition focus:outline-none">✏️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- BULK ACTION FLOATING BAR --- */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 animate-fade-in border border-gray-700">
          <span className="text-sm font-bold bg-gray-800 px-3 py-1 rounded-full">{selectedIds.length} Selected</span>
          <div className="w-px h-6 bg-gray-700"></div>
          <button 
            onClick={handleBulkDelete}
            disabled={isUpdating}
            className="text-sm font-black text-red-400 hover:text-red-300 transition disabled:opacity-50"
          >
            {isUpdating ? '...' : 'Delete'}
          </button>
          <button 
            onClick={() => setSelectedIds([])}
            disabled={isUpdating}
            className="text-sm font-bold text-gray-400 hover:text-white transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* --- RAPID INSERTION SCANNER MODAL --- */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden relative animate-fade-in flex flex-col max-h-[95vh]">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
              <h3 className="font-black text-gray-900 text-xl tracking-tight">Add to Collection</h3>
              <button onClick={() => setIsScannerModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
            </div>
            
            <div className="p-5 overflow-y-auto bg-gray-50 flex-1">
              
              {/* MANDATORY LOCATION CONTROL BLOCK */}
              <div className="bg-white border-2 border-emerald-500 rounded-2xl p-4 mb-6 shadow-sm">
                <label className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center justify-between mb-2 pl-1">
                  <span>📍 Active Location</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">REQUIRED</span>
                </label>
                <input 
                  type="text" name="location" list="location-options" value={formData.location} 
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                  className="w-full border-0 bg-emerald-50/50 rounded-xl px-4 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:font-normal placeholder:text-emerald-300" 
                  placeholder="Set Location to activate Scanner/Search..." 
                />
              </div>

              <div className="flex p-1 bg-gray-200 rounded-xl mb-5">
                <button onClick={() => setScanTab('barcode')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${scanTab === 'barcode' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📷 Barcode</button>
                <button onClick={() => setScanTab('catalog')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${scanTab === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>📄 Catalog</button>
                <button onClick={() => setScanTab('text')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${scanTab === 'text' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>⌨️ Search</button>
              </div>

              {scanTab === 'barcode' && (
                <div className="animate-fade-in">
                  <div className="flex gap-2">
                    <input 
                      type="text" placeholder={!formData.location.trim() ? "⚠️ Set active location first..." : "Type UPC barcode here..."} value={barcode} 
                      disabled={!formData.location.trim() || isSearchingDiscogs} onChange={(e) => setBarcode(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); processBarcodeLookup(barcode); } }}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-white disabled:bg-gray-100 font-medium" 
                    />
                    <button type="button" onClick={() => setShowScanner(true)} disabled={!formData.location.trim() || isSearchingDiscogs} className="bg-gray-900 hover:bg-emerald-600 text-white rounded-xl px-5 font-black transition shadow-sm disabled:opacity-50 flex items-center gap-2">
                      {isSearchingDiscogs ? '⏳' : '📷 Scan'}
                    </button>
                  </div>
                </div>
              )}

              {scanTab === 'catalog' && (
                <div className="animate-fade-in">
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" placeholder={!formData.location.trim() ? "⚠️ Set active location first..." : "e.g. FC 37152..."} value={catalog} 
                        disabled={!formData.location.trim() || isSearchingDiscogs} onChange={(e) => setCatalog(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCatalogLookup(catalog); } }}
                        className="w-full border border-gray-200 rounded-xl pl-4 pr-16 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-white disabled:bg-gray-100 font-medium" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {catalog && !isListening && <button type="button" onClick={() => setCatalog("")} className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1">✕</button>}
                        <button type="button" onClick={() => startVoiceSearch('catalog')} disabled={!formData.location.trim() || isSearchingDiscogs} className={`p-1.5 rounded-lg transition ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-emerald-500'}`}>🎤</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => handleCatalogLookup(catalog)} disabled={!formData.location.trim() || isSearchingDiscogs || !catalog} className="bg-gray-900 hover:bg-emerald-600 text-white rounded-xl px-5 font-black transition shadow-sm disabled:opacity-50">
                      Search
                    </button>
                  </div>
                  <button type="button" onClick={() => setShowCatalogScanner(true)} disabled={!formData.location.trim() || isSearchingDiscogs} className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl py-3 text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50">📷 Use Camera OCR Reader</button>
                </div>
              )}

              {scanTab === 'text' && (
                <div className="animate-fade-in">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" placeholder={!formData.location.trim() ? "⚠️ Set active location first..." : "e.g. Pink Floyd Dark Side"} value={textQuery} 
                        disabled={!formData.location.trim() || isSearchingText} onChange={(e) => setTextQuery(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') handleTextSearch(e); }}
                        className="w-full border border-gray-200 rounded-xl pl-4 pr-16 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-white disabled:bg-gray-100 font-medium" 
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {textQuery && !isListening && <button type="button" onClick={() => setTextQuery("")} className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1">✕</button>}
                        <button type="button" onClick={() => startVoiceSearch('text')} disabled={!formData.location.trim() || isSearchingText} className={`p-1.5 rounded-lg transition ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-emerald-500'}`}>🎤</button>
                      </div>
                    </div>
                    <button type="button" onClick={handleTextSearch} disabled={!formData.location.trim() || isSearchingText || !textQuery} className="bg-gray-900 hover:bg-emerald-600 text-white rounded-xl px-5 font-black transition shadow-sm disabled:opacity-50">
                      Search
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-4 border border-gray-200 rounded-xl bg-white shadow-sm max-h-80 overflow-y-auto w-full divide-y divide-gray-100">
                      {searchResults.map((res: any) => {
                        const isCurrentlyExpanded = previewReleaseId === res.id;
                        const isLocationBlank = !formData.location.trim();
                        
                        return (
                          <div key={res.id} className="p-3 bg-white transition flex flex-col">
                            <div className="flex gap-3 items-center w-full">
                              {res.thumb ? (
                                <img src={res.thumb} alt="cover" className="w-12 h-12 object-cover rounded-lg shadow-sm flex-shrink-0" />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 flex-shrink-0">No Img</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 leading-tight truncate">{res.title}</p>
                                <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider truncate">
                                  {res.year || 'N/A'} • {res.country || 'N/A'} • {res.label?.[0] || 'Unknown'}
                                </p>
                              </div>
                              
                              <div className="flex-shrink-0 pl-1">
                                <button 
                                  type="button" 
                                  disabled={isLocationBlank}
                                  onClick={() => handleTogglePreview(res.id)}
                                  className={`w-10 h-10 rounded-xl border flex items-center justify-center text-base transition-all ${
                                    isLocationBlank 
                                      ? 'bg-gray-100 border-gray-200 opacity-40 cursor-not-allowed text-gray-400' 
                                      : isCurrentlyExpanded 
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-500/20' 
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                  }`}
                                  title={isLocationBlank ? "Please set collector location before viewing details" : "Preview release details"}
                                >
                                  👁️
                                </button>
                              </div>
                            </div>

                            {/* DYNAMIC SECONDARY PREVIEW SHEET */}
                            {isCurrentlyExpanded && (
                              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs animate-fade-in">
                                {isFetchingPreview ? (
                                  <div className="text-center py-2 text-gray-400 font-bold animate-pulse">Consulting Discogs Database...</div>
                                ) : previewDetails ? (
                                  <div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <div className="bg-white p-2 border border-gray-100 rounded-lg">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Discogs Value Est.</p>
                                        <p className="text-sm font-black text-blue-600 mt-0.5">
                                          {previewDetails.market_price ? `$${parseFloat(previewDetails.market_price).toFixed(2)}` : 'N/A'}
                                        </p>
                                      </div>
                                      <div className="bg-white p-2 border border-gray-100 rounded-lg">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Vinyl Weight</p>
                                        <p className="text-sm font-black text-gray-800 mt-0.5">
                                          {previewDetails.weight ? `${previewDetails.weight}g` : '120g (Std)'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {previewDetails.tracklist && previewDetails.tracklist.length > 0 && (
                                      <div className="mb-3 max-h-24 overflow-y-auto border border-gray-200 rounded-lg bg-white p-1">
                                        <p className="text-[9px] font-bold text-gray-400 px-1 uppercase sticky top-0 bg-white">Track List</p>
                                        {previewDetails.tracklist.slice(0, 4).map((t: any, idx: number) => (
                                          <p key={idx} className="text-[10px] text-gray-600 px-1 truncate font-medium">{t.position || idx+1}. {t.title}</p>
                                        ))}
                                        {previewDetails.tracklist.length > 4 && <p className="text-[9px] text-gray-400 italic px-1">+{previewDetails.tracklist.length - 4} more tracks</p>}
                                      </div>
                                    )}

                                    <button 
                                      type="button" 
                                      onClick={handleSelectFromPreview}
                                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-center shadow-lg shadow-emerald-500/10 transition transform active:scale-[0.99]"
                                    >
                                      Commit Verified Release to Vault
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-center text-red-500 font-semibold">Failed to fetch deep details.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {lookupError && (
                <div className="mt-4 text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-center">
                  {lookupError}
                </div>
              )}

            </div>
            
            <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-gray-600 group-hover:text-gray-900 transition">Auto-Save On Scan</span>
              </label>
              <button onClick={openManualAddModal} className="text-xs font-black text-gray-500 hover:text-emerald-700 transition">✍️ Add Manually</button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => setViewItem(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="flex gap-4">
                <button onClick={() => handleRematchRelease(viewItem)} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">🔄 Re-match Release</button>
              </div>

              <div className="flex gap-4">
                <div className={`border rounded-xl p-4 flex-1 ${viewItem.price_cents > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${viewItem.price_cents > 0 ? 'text-emerald-800' : 'text-gray-500'}`}>Your Price</p>
                  <p className={`text-2xl ${viewItem.price_cents > 0 ? 'font-black text-emerald-600' : 'font-medium text-gray-400'}`}>${(viewItem.price_cents / 100).toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex-1">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Market Est.</p>
                  <p className="text-2xl font-black text-blue-600">{viewItem.market_price_cents ? `$${(viewItem.market_price_cents / 100).toFixed(2)}` : 'N/A'}</p>
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
            </div>
          </div>
        </div>
      )}

      {/* --- UNIVERSAL RECORD MODAL (Add & Edit) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">{itemToEdit ? "Edit Inventory Record" : "Review & Add Record"}</h3>
              <button onClick={() => { setIsModalOpen(false); setItemToEdit(null); }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="recordForm" onSubmit={handleModalSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Title <span className="text-red-500">*</span></label>
                  <div className="relative w-full">
                    <input type="text" name="title" required value={editFormData.title} onChange={(e) => setEditFormData({...editFormData, title: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    {editFormData.title && <button type="button" onClick={() => setEditFormData({...editFormData, title: ""})} className="absolute right-3 top-1/2 translate-y-[1px] text-gray-400 hover:text-gray-600 font-bold text-xs">✕</button>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Artist <span className="text-red-500">*</span></label>
                  <div className="relative w-full">
                    <input type="text" name="artist" required value={editFormData.artist} onChange={(e) => setEditFormData({...editFormData, artist: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    {editFormData.artist && <button type="button" onClick={() => setEditFormData({...editFormData, artist: ""})} className="absolute right-3 top-1/2 translate-y-[1px] text-gray-400 hover:text-gray-600 font-bold text-xs">✕</button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1 flex items-center gap-1">
                      Your Price ($) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" name="price" step="0.01" required value={editFormData.price} onChange={(e) => setEditFormData({...editFormData, price: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    
                    {/* PUBLIC/PRIVATE LOGIC TOOLTIP */}
                    <div className={`mt-2 p-2 rounded-lg border text-[10px] font-semibold flex gap-2 items-start transition-colors ${parseFloat(editFormData.price || "0") > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                      <span className="text-xs">{parseFloat(editFormData.price || "0") > 0 ? '📡' : '🔒'}</span>
                      <p className="leading-tight">
                        {parseFloat(editFormData.price || "0") > 0 
                          ? "This record is priced and will broadcast LIVE to the public radar map."
                          : "Price is $0.00. This item will remain private in your local inventory."}
                      </p>
                    </div>

                  </div>
                  <div>
                    <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider pl-1">Discogs Lowest ($)</label>
                    <input type="number" name="market_price" readOnly value={editFormData.market_price} className="w-full mt-1.5 border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="N/A" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Weight (g)</label>
                    <input type="number" name="weight" value={editFormData.weight} onChange={(e) => setEditFormData({...editFormData, weight: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Qty</label>
                    <input type="number" name="quantity" min="1" value={editFormData.quantity} onChange={(e) => setEditFormData({...editFormData, quantity: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Condition</label>
                    <select value={editFormData.condition} onChange={(e) => setEditFormData({...editFormData, condition: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="NEW">NEW</option>
                      <option value="M">M (Mint)</option>
                      <option value="NM">NM (Near Mint)</option>
                      <option value="EX">EX (Excellent)</option>
                      <option value="VG+">VG+</option>
                      <option value="VG">VG (Very Good)</option>
                      <option value="G">G (Good)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Location</label>
                  <div className="w-full">
                    <input type="text" name="location" list="location-options" value={editFormData.location} onChange={(e) => setEditFormData({...editFormData, location: e.target.value})} className="w-full mt-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" placeholder="Select or type a location..." />
                  </div>
                </div>
               </form>

               {/* --- HI-RES CAMERA GALLERY UPLOADER --- */}
               {itemToEdit && (
                 <div className="mt-6 border-t border-gray-100 pt-5">
                   <div className="flex justify-between items-end mb-3">
                     <div>
                       <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">📷 High-Res Camera Roll</h4>
                       <p className="text-xs text-gray-500 leading-tight mt-1">Snap photos of specific details for buyers to verify.</p>
                     </div>
                     <select value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                       <option value="Dead Wax / Matrix">Dead Wax / Matrix</option>
                       <option value="Center Label">Center Label</option>
                       <option value="Front Cover">Front Cover</option>
                       <option value="Back Cover">Back Cover</option>
                       <option value="Damage / Wear">Damage / Wear</option>
                       <option value="Inserts / Extras">Inserts / Extras</option>
                     </select>
                   </div>
                   
                   <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                     {galleryImages.map(img => (
                       <div key={img.id} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                         <img src={img.image_url} alt="Gallery item" className="w-full h-full object-cover" />
                         <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                           <p className="text-[8px] text-white font-bold uppercase tracking-wider text-center truncate">{img.caption}</p>
                         </div>
                         <button type="button" onClick={() => handleDeleteImage(img.id)} className="absolute top-1.5 right-1.5 bg-gray-900/80 hover:bg-red-500 text-white rounded-full w-7 h-7 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">✕</button>
                       </div>
                     ))}
                     <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-600 cursor-pointer transition">
                       <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                       <span className="text-2xl mb-1">{isUploading ? '⏳' : '➕'}</span>
                       <span className="text-[10px] font-bold uppercase tracking-wider text-center px-1">{isUploading ? 'Uploading...' : 'Take Photo'}</span>
                     </label>
                   </div>
                 </div>
               )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-2 sm:gap-3">
              {itemToEdit && (
                <button type="button" onClick={() => handleDeleteRecord(itemToEdit.id)} disabled={isUpdating} className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl px-4 py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 flex items-center justify-center">🗑️</button>
              )}
              <button type="button" onClick={() => { setIsModalOpen(false); setItemToEdit(null); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl py-3.5 text-sm font-bold transition shadow-sm">Cancel</button>
              <button type="submit" form="recordForm" disabled={isUpdating} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50">{isUpdating ? 'Saving...' : (itemToEdit ? 'Update' : 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- BARCODE SCANNER MODAL --- */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in">
            <button onClick={() => setShowScanner(false)} className="absolute top-4 right-4 z-10 bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shadow hover:bg-gray-700 transition">✕</button>
            <div className="p-4 bg-gray-50 border-b border-gray-200 text-center">
              <h3 className="font-bold text-gray-900">Scan Barcode</h3>
              <p className="text-xs text-gray-500">Center the barcode in the camera view</p>
            </div>
            <BarcodeScanner onDetected={async (code: string) => { setBarcode(code); setShowScanner(false); await processBarcodeLookup(code); }} />
          </div>
        </div>
      )}

      {/* --- CATALOG OCR SCANNER MODAL --- */}
      {showCatalogScanner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80 p-4 animate-fade-in">
          <CatalogScanner onClose={() => setShowCatalogScanner(false)} onDetected={async (text: string) => { setCatalog(text); setShowCatalogScanner(false); await handleCatalogLookup(text); }} />
        </div>
      )}

    </main>
  );
}
