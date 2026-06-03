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

  // Modal States
  const [viewItem, setViewItem] = useState<PublicRecord | null>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [showLeadModal, setShowLeadModal] = useState(false);
  
  // Lead Form States
  const [guestEmail, setGuestEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  useEffect(() => {
    fetchPublicRadar();
  }, []);

  // Fetch High-Res Gallery Images when a record is inspected
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
    
    // Fetch records > $0.00 and join the vendor's store name
    const { data, error } = await supabase
      .from("inventory")
      .select("*, vendor_profiles(store_name)")
      .gt("price_cents", 0)
      .order("id", { ascending: false });

    if (!error && data) {
      setRecords(data);

      // Group records by vendor to build the "Active Local Vaults" list
      const vendorMap = new Map<string, LocalVendor>();
      
      data.forEach((record: any) => {
        if (!vendorMap.has(record.vendor_id)) {
          // Generate a pseudo-random distance strictly for UI demonstration around the Eastvale area
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
      }, 3000);
    }
  };

  const filteredRecords = records.filter(record => 
    searchQuery === "" || 
    record.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    record.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* --- PUBLIC HEADER --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-8 h-8 object-contain rounded-md shadow-sm" />
          <h1 className="text-xl font-black tracking-tight text-gray-900">TimbreBox</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-bold text-gray-600 hover:text-emerald-600 transition hidden sm:block">
            Member Login
          </Link>
          <Link href="/login" className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-5 py-2 rounded-xl hover:bg-emerald-100 transition shadow-sm">
            Open Your Vault
          </Link>
        </div>
      </header>

      {/* --- HERO & INTRODUCTION --- */}
      <section className="bg-gray-900 text-white pt-16 pb-20 px-6 text-center border-b-[6px] border-emerald-500">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 leading-tight">
            The local network for <br className="hidden sm:block"/>
            <span className="text-emerald-400">true analog sound.</span>
          </h2>
          <p className="text-lg text-gray-400 font-medium leading-relaxed mb-10">
            Welcome to TimbreBox. Explore the live public radar below to find verified records from local collectors. See something you need? Inspect the high-res photos and ping the vendor directly to secure your wax. 
          </p>
          
          <div className="relative w-full max-w-xl mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl">🔍</span>
            <input 
              type="text" 
              placeholder="Search artists, albums, or labels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-lg font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/50 bg-white text-gray-900 shadow-xl transition"
            />
          </div>
        </div>
      </section>

      {/* --- ACTIVE LOCAL VENDORS --- */}
      {!loading && vendors.length > 0 && (
        <section className="bg-white border-b border-gray-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <span>📡</span> Active Local Vaults
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {vendors.map(v => (
                <div key={v.id} className="bg-gray-50 border border-gray-200 p-4 rounded-2xl min-w-[240px] shadow-sm flex flex-col flex-shrink-0">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-900 truncate pr-2">{v.name}</h4>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                      {v.recordCount} Records
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-bold flex items-center gap-1 mt-auto">
                    📍 ~{v.distance} miles from Eastvale
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --- COLLECTIONS CORNER - VISUAL VERIFICATION --- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-baseline justify-between mb-8 border-b border-gray-200 pb-4">
          <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            Collections Corner <span className="text-emerald-600 text-sm bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">Visual Verification</span>
          </h3>
          <p className="text-sm font-bold text-gray-500 mt-2 sm:mt-0">Showing {filteredRecords.length} live records</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 font-bold animate-pulse text-lg">Loading visual archives...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-4 opacity-20">📭</div>
            <p className="text-gray-500 font-bold text-lg">No records match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredRecords.map((record) => (
              <div 
                key={record.id} 
                onClick={() => setViewItem(record)}
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
                  <p className="text-sm text-gray-500 font-medium mb-1 truncate">{record.artist}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 truncate">
                    By: {record.vendor_profiles?.store_name || "Collector"}
                  </p>
                  
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
      </section>

      {/* --- INSPECT MODAL --- */}
      {viewItem && !showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center z-10">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Item Inspection
              </span>
              <button onClick={() => setViewItem(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>
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
                      onClick={() => setShowLeadModal(true)}
                      className="bg-gray-900 hover:bg-gray-800 text-white font-black text-lg px-8 py-4 rounded-xl shadow-xl transition transform active:scale-95"
                    >
                      Interested
                    </button>
                  </div>
                </div>
              </div>

              {/* --- RESTORED: THE DARK THEME HI-RES GALLERY --- */}
              {galleryImages.length > 0 && (
                <div className="border-t border-gray-100 pt-6 mb-6">
                  <div className="bg-gray-900 rounded-2xl p-5 shadow-inner border border-gray-800 relative overflow-hidden">
                    {/* Decorative accent */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none"></div>
                    
                    <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-lg">🔍</span> Visual Inspection Gallery
                    </h4>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar relative z-10">
                      {galleryImages.map(img => (
                        <div key={img.id} className="relative w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden border-2 border-gray-700 hover:border-emerald-500 transition-colors cursor-crosshair group shadow-lg">
                          <img 
                            src={img.image_url} 
                            alt={img.caption} 
                            className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700" 
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

      {/* --- LEAD CAPTURE MODAL --- */}
      {showLeadModal && viewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/90 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-fade-in">
            
            <button 
              onClick={() => { setShowLeadModal(false); setLeadSuccess(false); }} 
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
                  The vendor has been notified and will reach out to you directly to coordinate.
                </p>
              </div>
            ) : (
              <div className="p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100">
                    📨
                  </div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Connect with Vendor</h3>
                  <p className="text-sm text-gray-500 font-medium mt-2">
                    Drop your email below. We'll instantly notify the seller you are interested in <strong>{viewItem.title}</strong>.
                  </p>
                </div>

                <form onSubmit={handleInterestSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1 mb-1 block">Your Email Address <span className="text-red-500">*</span></label>
                    <input 
                      type="email" 
                      required 
                      autoFocus
                      placeholder="collector@example.com"
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
                    {isSubmitting ? 'Sending Ping...' : 'Send Request to Vendor'}
                  </button>
                  <p className="text-[10px] text-center text-gray-400 font-medium mt-2 px-4">
                    TimbreBox keeps your email private until the vendor reaches out to complete the handoff.
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
