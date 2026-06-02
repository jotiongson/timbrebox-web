"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase";
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
}

export default function PublicRadarPage() {
  const [records, setRecords] = useState<PublicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [viewItem, setViewItem] = useState<PublicRecord | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  
  // Lead Form States
  const [guestEmail, setGuestEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  useEffect(() => {
    fetchPublicRadar();
  }, []);

  async function fetchPublicRadar() {
    setLoading(true);
    // Only fetch records where the price is strictly greater than 0
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .gt("price_cents", 0)
      .order("id", { ascending: false });

    if (!error && data) {
      setRecords(data);
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 sm:px-8 py-4 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <img src="/icons/icon-512x512.png" alt="TimbreBox Logo" className="w-8 h-8 object-contain rounded-md shadow-sm" />
          <h1 className="text-xl font-black tracking-tight text-gray-900 hidden sm:block">TimbreBox</h1>
        </Link>
        <div className="flex items-center gap-3 w-full sm:w-auto max-w-md sm:max-w-none ml-4 sm:ml-0">
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search artists, albums..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-gray-50 transition"
            />
          </div>
          <Link href="/login" className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition whitespace-nowrap">
            Vendor Login
          </Link>
        </div>
      </header>

      {/* --- HERO BANNER --- */}
      <section className="bg-gray-900 text-white pt-12 pb-16 px-6 text-center">
        <div className="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
          Live Local Inventory
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">The Public Radar</h2>
        <p className="text-gray-400 font-medium max-w-xl mx-auto text-sm sm:text-base">
          Browse fresh crates dropping locally. See something you need? Inspect the details and ping the vendor directly to secure your wax.
        </p>
      </section>

      {/* --- RADAR GRID --- */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        {loading ? (
          <div className="py-20 text-center text-gray-400 font-bold animate-pulse text-lg">Scanning local crates...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-4 opacity-20">💿</div>
            <p className="text-gray-500 font-bold text-lg">No public records found on the radar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredRecords.map((record) => (
              <div 
                key={record.id} 
                onClick={() => setViewItem(record)}
                className="bg-white border border-gray-200 rounded-3xl p-4 shadow-sm hover:shadow-lg hover:border-emerald-300 transition cursor-pointer group flex flex-col h-full"
              >
                <div className="aspect-square w-full mb-4 overflow-hidden rounded-2xl bg-gray-100 relative">
                  {record.cover_image ? (
                    <img src={record.cover_image} alt="cover" className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">💿</div>
                  )}
                  <div className="absolute top-2 right-2 bg-gray-900/80 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                    {record.condition}
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <h3 className="font-black text-gray-900 leading-tight mb-1 line-clamp-2">{record.title}</h3>
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
      </section>

      {/* --- INSPECT MODAL --- */}
      {viewItem && !showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative animate-fade-in flex flex-col max-h-[90vh]">
            
            <button onClick={() => setViewItem(null)} className="absolute top-4 right-4 z-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition">✕</button>

            <div className="p-6 overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-6 mb-8 mt-2">
                <div className="w-full sm:w-1/3 aspect-square bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm">
                  {viewItem.cover_image ? (
                    <img src={viewItem.cover_image} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">💿</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded mb-2">Available Now</div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-tight mb-1">{viewItem.title}</h2>
                  <p className="text-lg text-gray-500 font-medium mb-4">{viewItem.artist}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide">Cond: {viewItem.condition}</span>
                    <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide">Wgt: {viewItem.weight_grams}g</span>
                    {viewItem.year && <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide">Yr: {viewItem.year}</span>}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">Asking Price</p>
                      <p className="text-4xl font-black text-emerald-600">${(viewItem.price_cents / 100).toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => setShowLeadModal(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg px-8 py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition transform active:scale-95"
                    >
                      Interested
                    </button>
                  </div>
                </div>
              </div>

              {viewItem.tracklist && viewItem.tracklist.length > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-black text-gray-900 mb-3 text-lg">Tracklist Verification</h4>
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 p-2">
                    {viewItem.tracklist.map((track: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-3 border-b border-gray-100 last:border-b-0 hover:bg-white transition rounded-lg">
                        <div className="flex gap-4">
                          <span className="text-xs font-bold text-gray-400 w-4">{track.position || i+1}</span>
                          <span className="text-sm font-bold text-gray-800">{track.title}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-500">{track.duration}</span>
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
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">
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
