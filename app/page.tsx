"use client";

import { useState, useEffect } from "react";
import { supabase } from "./supabase"; 
import Link from "next/link";

interface PublicRecord {
  id: number;
  vendor_id: string;
  artist: string;
  title: string;
  weight_grams: number;
  price_cents: number;
  market_price_cents?: number;
  condition: string;
  year?: string;
  cover_image?: string;
  tracklist?: any[];
  location?: string;
  vendor_profiles?: {
    store_name: string;
  };
}

interface LocalVendor {
  id: string;
  name: string;
  recordCount: number;
  distance: number;
}

export default function MasterLandingPage() {
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [vendors, setVendors] = useState<LocalVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbError, setDbError] = useState("");

  // Auth & Identity States
  const [session, setSession] = useState<any>(null);
  const [collectorName, setCollectorName] = useState<string | null>(null);

  // Navigation State
  const [selectedVendor, setSelectedVendor] = useState<LocalVendor | null>(null);

  // Modal States
  const [viewItem, setViewItem] = useState<PublicRecord | null>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  
  // Lead Form States
  const [guestEmail, setGuestEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  // --- NATIVE MOBILE BACK BUTTON LISTENER ---
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const handleHashChange = () => {
      const h = window.location.hash;
      
      if (h === '#lead') {
        setFullScreenImage(null);
      } else if (h === '#inspect') {
        setFullScreenImage(null);
        setShowLeadModal(false);
        setLeadSuccess(false);
      } else if (h === '#vault') {
        setFullScreenImage(null);
        setShowLeadModal(false);
        setViewItem(null);
      } else if (h === '' || h === '#') {
        setFullScreenImage(null);
        setShowLeadModal(false);
        setViewItem(null);
        setSelectedVendor(null);
        setSearchQuery("");
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // --- CHECK AUTHENTICATION IDENTITY ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchCollectorProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchCollectorProfile(session.user.id);
      } else {
        setCollectorName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchCollectorProfile(userId: string) {
    const { data } = await supabase
      .from("vendor_profiles")
      .select("store_name")
      .eq("id", userId)
      .single();
    if (data && data.store_name) {
      setCollectorName(data.store_name);
    }
  }

  // --- FETCH RADAR DATA ---
  useEffect(() => {
    fetchPublicRadar();
  }, []);

  useEffect(() => {
    if (viewItem) {
      async function fetchGallery() {
        const { data } = await supabase
          .from('record_images')
          .select('*')
          .eq('record_id', viewItem?.id)
          .order('created_at', { ascending: true });
        
        setGalleryImages(data || []);
      }
      fetchGallery();
    } else {
      setGalleryImages([]);
    }
  }, [viewItem]);

  async function fetchPublicRadar() {
    setLoading(true);
    setDbError("");
    
    const { data, error } = await supabase
      .from("inventory")
      .select("*, vendor_profiles(store_name)")
      .gt("price_cents", 0)
      .order("id", { ascending: false });

    if (error) {
      console.error("🚨 Supabase Error:", error);
      setDbError(error.message || "Failed to fetch from database.");
    } else if (data) {
      setRecords(data);

      const vendorMap = new Map<string, LocalVendor>();
      
      data.forEach((record: any) => {
        if (!vendorMap.has(record.vendor_id)) {
          const mockDistance = Math.floor(Math.random() * 12) + 1; 
          
          vendorMap.set(record.vendor_id, {
            id: record.vendor_id,
            name: record.vendor_profiles?.store_name || "Independent Collector",
            recordCount: 1,
            distance: mockDistance
          });
        } else {
          const v = vendorMap.get(record.vendor_id)!;
          v.recordCount += 1;
        }
      });

      setVendors(Array.from(vendorMap.values()).sort((a, b) => b.recordCount - a.recordCount));
    }
    setLoading(false);
  }

  const handleInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail || !viewItem) return;

    setIsSubmitting(true);

    const { error } = await supabase.from('buyer_leads').insert([{
      record_id: viewItem.id,
      vendor_id: viewItem.vendor_id,
      guest_email: guestEmail,
      status: 'new'
    }]);

    setIsSubmitting(false);

    if (error) {
      alert("Something went wrong sending your request. Please try again.");
    } else {
      setLeadSuccess(true);
      setTimeout(() => {
        setShowLeadModal(false);
        setLeadSuccess(false);
        setGuestEmail("");
        setViewItem(null);
        window.history.replaceState(null, '', window.location.pathname + '#vault');
      }, 3000);
    }
  };

  const vendorRecords = selectedVendor 
    ? records.filter(r => r.vendor_id === selectedVendor.id && 
        (searchQuery === "" || 
         r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
         r.artist.toLowerCase().includes(searchQuery.toLowerCase())))
    : [];

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* --- PUBLIC HEADER --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => { 
            setSelectedVendor(null); 
            setSearchQuery(""); 
            setViewItem(null);
            window.history.replaceState(null, '', window.location.pathname);
          }}
        >
          <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-8 h-8 object-contain rounded-md shadow-sm flex-shrink-0" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              TimbreBox <span className="text-emerald-600 font-bold text-xs sm:text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 mt-0.5 sm:mt-0">Radar</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              {session ? `Viewing as: ${collectorName || 'Collector'}` : 'Viewing as: Guest'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <Link href="/vendor" className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-5 py-2 rounded-xl hover:bg-emerald-100 transition shadow-sm whitespace-nowrap">
              Return to Vault
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-bold text-gray-600 hover:text-emerald-600 transition hidden sm:block whitespace-nowrap">
                Member Login
              </Link>
              <Link href="/login" className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-5 py-2 rounded-xl hover:bg-emerald-100 transition shadow-sm whitespace-nowrap">
                Open Your Vault
              </Link>
            </>
          )}
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      {!selectedVendor && (
        <section className="bg-gray-900 text-white pt-16 pb-16 px-6 text-center border-b-[6px] border-emerald-500">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 leading-tight">
              The local network for <br className="hidden sm:block"/>
              <span className="text-emerald-400">true analog sound.</span>
            </h2>
            <p className="text-lg text-gray-400 font-medium leading-relaxed mb-0">
              Welcome to TimbreBox Vinyl Records. Browse the live public <strong>Radar</strong> below to discover albums actively broadcasting from local collectors' private <strong>Vaults</strong>. See a record you need? Inspect the high-res photos to visually verify the condition, then ping the collector directly to secure your copy.
            </p>
          </div>
        </section>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <section className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        
        {dbError && (
          <div className="mb-10 text-center">
            <div className="bg-red-50 text-red-600 border border-red-200 p-6 rounded-2xl inline-block shadow-sm max-w-lg w-full">
              <h4 className="font-black text-lg mb-1">Database Connection Blocked</h4>
              <p className="font-medium text-sm">{dbError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-bold animate-pulse text-lg">Scanning the local network...</div>
        ) : !selectedVendor ? (
          
          /* --- VIEW 1: TIGHT COLLECTOR VAULT LIST --- */
          <div className="animate-fade-in">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2 px-2">
              <span>📡</span> Active Local Vaults
            </h3>
            
            {vendors.length === 0 && !dbError ? (
              <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center shadow-sm">
                <div className="text-5xl mb-4 opacity-20">📭</div>
                <p className="text-gray-500 font-bold text-lg">No local vaults are broadcasting right now.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {vendors.map(v => (
                  <button 
                    key={v.id}
                    onClick={() => { setSelectedVendor(v); window.location.hash = 'vault'; }}
                    className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-400 transition-all text-left w-full group"
                  >
                    <div className="flex flex-col">
                      <span className="font-black text-lg text-gray-900 leading-tight group-hover:text-emerald-700 transition-colors">{v.name}</span>
                      <span className="text-xs font-bold text-gray-500 mt-1">📍 ~{v.distance} miles from Eastvale</span>
                    </div>
                    <div className="bg-gray-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-black border border-gray-200 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors flex items-center gap-2">
                      {v.recordCount} Records <span className="text-emerald-500 text-lg leading-none">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        ) : (

          /* --- VIEW 2: COLLECTOR'S SPECIFIC INVENTORY GRID --- */
          <div className="animate-fade-in">
            <button 
              onClick={() => window.history.back()}
              className="text-sm font-bold text-gray-500 hover:text-emerald-600 mb-6 flex items-center gap-2 transition"
            >
              ← Back to Local Vaults
            </button>

            <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border-b-4 border-emerald-500">
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-1">{selectedVendor.name}</h2>
                <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">Visual Verification Vault</p>
              </div>
              
              <div className="relative w-full sm:w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search this vault..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 transition"
                />
              </div>
            </div>

            {vendorRecords.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4 opacity-20">💿</div>
                <p className="text-gray-500 font-bold text-lg">No records match your search in this vault.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                {vendorRecords.map((record) => (
                  <div 
                    key={record.id} 
                    onClick={() => { setViewItem(record); window.location.hash = 'inspect'; }}
                    className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all duration-300 cursor-pointer group flex flex-col h-full"
                  >
                    <div className="aspect-square w-full mb-4 overflow-hidden rounded-2xl bg-gray-100 relative">
                      {record.cover_image ? (
                        <img src={record.cover_image} alt="cover" className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">💿</div>
                      )}
                      <div className="absolute top-2 left-2 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                        Verified
                      </div>
                      <div className="absolute top-2 right-2 bg-gray-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                        {record.condition}
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                      <h4 className="font-black text-gray-900 leading-tight mb-1 line-clamp-2">{record.title}</h4>
                      <p className="text-sm text-gray-500 font-medium mb-3 truncate">{record.artist}</p>
                      
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="font-black text-lg text-emerald-600">${(record.price_cents / 100).toFixed(2)}</span>
                        <button className="text-xs font-bold text-gray-400 group-hover:text-emerald-600 transition flex items-center gap-1">
                          Inspect <span>→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- INSPECT MODAL (VISUAL VERIFICATION) --- */}
      {viewItem && !showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center z-10">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Item Inspection
              </span>
              <button onClick={() => window.history.back()} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-8 mb-6">
                <div className="w-full sm:w-2/5 aspect-square bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-200 shadow-inner">
                  {viewItem.cover_image ? (
                    <img src={viewItem.cover_image} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">💿</div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight mb-2">{viewItem.title}</h2>
                  <p className="text-xl text-gray-500 font-medium mb-4">{viewItem.artist}</p>
                  
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Condition</p>
                      <p className="text-sm font-black text-gray-800 mt-0.5">{viewItem.condition}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Weight</p>
                      <p className="text-sm font-black text-gray-800 mt-0.5">{viewItem.weight_grams}g</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</p>
                      <p className="text-sm font-black text-gray-800 mt-0.5">{viewItem.year || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between mt-auto">
                    <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-0.5">Asking Price</p>
                      <p className="text-4xl font-black text-emerald-600">${(viewItem.price_cents / 100).toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => { setShowLeadModal(true); window.location.hash = 'lead'; }}
                      className="bg-gray-900 hover:bg-gray-800 text-white font-black text-lg px-8 py-4 rounded-xl shadow-xl transition transform active:scale-95"
                    >
                      Interested
                    </button>
                  </div>
                </div>
              </div>

              {/* --- THE DARK THEME HI-RES GALLERY --- */}
              {galleryImages.length > 0 && (
                <div className="border-t border-gray-100 pt-6 mb-6">
                  <div className="bg-gray-900 rounded-2xl p-5 shadow-inner border border-gray-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="text-lg">🔍</span> Visual Inspection Gallery
                      </h4>
                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Tap photo to enlarge</span>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar relative z-10">
                      {galleryImages.map(img => (
                        <div 
                          key={img.id} 
                          onClick={() => { setFullScreenImage(img.image_url); window.location.hash = 'zoom'; }}
                          className="relative w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-700 hover:border-emerald-500 transition-colors cursor-zoom-in group shadow-lg"
                        >
                          <img 
                            src={img.image_url} 
                            alt={img.caption} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1.5 backdrop-blur-sm border-t border-gray-700">
                            <p className="text-[10px] text-white font-bold uppercase tracking-wider truncate text-center">
                              {img.caption}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- TRACKLIST --- */}
              {viewItem.tracklist && viewItem.tracklist.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-black text-gray-900 mb-4 text-lg">Tracklist Verification</h4>
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 p-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    {viewItem.tracklist.map((track: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2 border-b border-gray-200/50 last:border-b-0 hover:bg-white transition rounded-lg">
                        <div className="flex gap-3 min-w-0">
                          <span className="text-[10px] font-bold text-gray-400 w-4 mt-0.5">{track.position || i+1}</span>
                          <span className="text-sm font-bold text-gray-800 truncate">{track.title}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-500 pl-2">{track.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- FULLSCREEN IMAGE OVERLAY --- */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-8 cursor-zoom-out animate-fade-in"
          onClick={() => window.history.back()}
        >
          <img 
            src={fullScreenImage} 
            alt="Full resolution inspection" 
            className="w-full h-full object-contain drop-shadow-2xl" 
          />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs font-bold px-4 py-2 rounded-full border border-gray-700 backdrop-blur-sm">
            Tap anywhere to close
          </div>
        </div>
      )}

      {/* --- LEAD CAPTURE MODAL --- */}
      {showLeadModal && viewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/90 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in">
            
            <button 
              onClick={() => { window.history.back(); setLeadSuccess(false); }} 
              className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition"
            >
              ✕
            </button>

            {leadSuccess ? (
              <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner mx-auto">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Request Sent!</h3>
                <p className="text-gray-500 font-medium">
                  The collector has been notified and will reach out to you directly to coordinate.
                </p>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100">
                    📨
                  </div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Connect with Collector</h3>
                  <p className="text-sm text-gray-500 font-medium mt-2">
                    Drop your email below. We'll instantly notify the collector you are interested in <strong>{viewItem.title}</strong>.
                  </p>
                </div>

                <form onSubmit={handleInterestSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1 mb-1 block">Your Email Address <span className="text-red-500">*</span></label>
                    <input 
                      type="email" 
                      required 
                      autoFocus
                      placeholder="buyer@example.com"
                      value={guestEmail} 
                      onChange={(e) => setGuestEmail(e.target.value)} 
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 bg-gray-50 transition font-medium" 
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 text-base font-black transition shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Sending Ping...' : 'Send Request to Collector'}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 font-medium mt-2 px-4">
                    TimbreBox keeps your email private until the collector reaches out to complete the handoff.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
