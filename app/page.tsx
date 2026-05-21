'use client';

import { useState } from 'react';
import { supabase } from './supabase';

interface ShopItem {
  id: number;
  title: string;
  artist: string;
  price_cents: number;
  weight_grams: number;
  distance_miles: number;
}

export default function ShopPage() {
  const [inventory, setInventory] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Browse active vinyl records in your area.');
  const [searched, setSearched] = useState(false);

  // Checkout State
  const [reservingItem, setReservingItem] = useState<ShopItem | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<ShopItem | null>(null);

  // 1. THE GEOLOCATION TRIGGER ROUTINE
  async function locateVinyl() {
    setLoading(true);
    setSearched(true);
    setStatusMsg('Pinging device GPS...');

    if (!navigator.geolocation) {
      setStatusMsg('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setStatusMsg('Coordinates acquired. Calculating PostGIS radius...');

        try {
          const { data, error } = await supabase.rpc('get_local_inventory', {
            buyer_lat: latitude,
            buyer_lon: longitude,
          });

          if (error) throw error;
          
          setInventory(data || []);
          setStatusMsg(data && data.length > 0 ? 'Local vault unlocked.' : 'No active inventory nearby.');
        } catch (err: any) {
          setStatusMsg(`Failed to query map matrix: ${err.message}`);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setStatusMsg('Location access denied. Please allow GPS permissions to find local records.');
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }

  // 2. FRICTIONLESS CHECKOUT ROUTINE
  async function handleReserve(e: React.FormEvent) {
    e.preventDefault();
    if (!reservingItem || !buyerName || !buyerEmail) return;

    try {
      setIsProcessing(true);
      
      // Update the database to lock the record so nobody else can buy it
      const { error } = await supabase
        .from('inventory')
        .update({ status: 'reserved' })
        .eq('id', reservingItem.id);

      if (error) throw error;

      // Show the success receipt and close the checkout slider
      setSuccessReceipt(reservingItem);
      setReservingItem(null);
      setBuyerName('');
      setBuyerEmail('');
      
      // Refresh the radar silently in the background to remove the bought item
      locateVinyl();
      
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 font-sans pb-12">
      {/* PUBLIC HEADER */}
      <header className="bg-white border-b border-gray-200 px-8 py-5 mb-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">TimbreBox<span className="text-emerald-600">.Market</span></h1>
          <a href="/vendor" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition border border-transparent hover:border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg">
            Vendor Login
          </a>
        </div>
      </header>

      <div className="p-8 max-w-5xl mx-auto pt-0">
        {/* INTERACTIVE RADAR HERO SECTION */}
        <section className="bg-gray-900 rounded-3xl p-10 text-center mb-10 shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">Find Vinyl Records Near You</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto text-sm md:text-base leading-relaxed">{statusMsg}</p>
            
            <button
              onClick={locateVinyl}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-gray-900 px-8 py-3.5 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? 'Scanning Radar...' : 'Scan Local Radar'}
              {!loading && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              )}
            </button>
          </div>
        </section>

        {/* DISTANCE-SORTED INVENTORY GRID */}
        {searched && !loading && inventory.length > 0 && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Local Inventory</h3>
              <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg">
                {inventory.length} Records Found
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {inventory.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition hover:shadow-md">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 tracking-tight leading-snug mb-1">{item.title}</h4>
                    <p className="text-gray-500 font-medium text-sm mb-4">{item.artist}</p>
                    <div className="bg-gray-50 rounded-lg p-2.5 flex items-center justify-between border border-gray-200 mb-6">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Distance</span>
                      <span className="text-sm font-black text-gray-900">{item.distance_miles} mi</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-emerald-600 text-xl">${(item.price_cents / 100).toFixed(2)}</span>
                    <button 
                      onClick={() => setReservingItem(item)}
                      className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold py-2 px-4 rounded-lg transition"
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* COMPONENT: FRICTIONLESS CHECKOUT MODAL */}
      {reservingItem && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full relative animate-fade-in">
            <button onClick={() => setReservingItem(null)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="mb-6">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1 block">Curbside Pickup</span>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">{reservingItem.title}</h3>
              <p className="text-gray-500 text-sm mt-1">{reservingItem.artist} • ${(reservingItem.price_cents / 100).toFixed(2)}</p>
            </div>

            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">First Name</label>
                <input type="text" required placeholder="e.g., John" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="w-full mt-1.5 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">Email Address (For Receipt)</label>
                <input type="email" required placeholder="john@example.com" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} className="w-full mt-1.5 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50" />
              </div>
              
              <button type="submit" disabled={isProcessing} className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-900 rounded-xl py-3.5 text-sm font-bold transition shadow-sm disabled:opacity-50 mt-4">
                {isProcessing ? 'Securing Record...' : 'Confirm Reservation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COMPONENT: SUCCESS RECEIPT (THE TROJAN HORSE) */}
      {successReceipt && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-10 shadow-2xl max-w-md w-full text-center animate-fade-in">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-6">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Record Secured!</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              We just emailed you the pickup details for <strong>{successReceipt.title}</strong>. The vendor has been notified and is expecting you.
            </p>
            
            {/* The Trojan Horse Upsell */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
              <p className="text-xs text-gray-500 font-medium mb-3">Want to list your own vinyl or swap with this vendor?</p>
              <button onClick={() => window.location.href = '/'} className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-2.5 text-sm font-semibold transition">
                Open a Free Seller Vault
              </button>
            </div>

            <button onClick={() => setSuccessReceipt(null)} className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition">
              Back to Radar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}