"use client";

import { useState } from 'react';
import { supabase } from './supabase'; // Adjust path if your client is elsewhere

// TypeScript definitions for our new grouped data
interface VinylRecord {
  id: number;
  title: string;
  artist: string;
  price_cents: number;
  weight_grams: number;
  condition: string;
  quantity: number;
  location?: string;
}

interface Store {
  store_id: string;
  store_name: string;
  store_bio: string;
  distance_miles: number;
  active_records: VinylRecord[];
}

export default function PublicRadar() {
  const [stores, setStores] = useState<Store[]>([]);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // 1. The Radar Ping
  const handleScanRadar = () => {
    setScanning(true);
    setErrorMsg('');
    setStores([]);

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setScanning(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        fetchNearbyStores(latitude, longitude);
      },
      (error) => {
        setErrorMsg('Please allow location access to find nearby vinyl.');
        setScanning(false);
      }
    );
  };

  // 2. Fetching from our new PostGIS brain
  const fetchNearbyStores = async (lat: number, lon: number) => {
    try {
      const { data, error } = await supabase.rpc('get_nearby_stores', {
        user_lat: lat,
        user_lon: lon,
        radius_miles: 25 // Scans a 25-mile radius
      });

      if (error) throw error;
      setStores(data || []);
    } catch (err: any) {
      console.error('Radar failure:', err.message);
      setErrorMsg('Supabase Error: ' + err.message); // <-- This will print the real error
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 font-sans p-6 md:p-12">
      {/* HEADER */}
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">TimbreBox<span className="text-emerald-600">.Radar</span></h1>
        <a href="/vendor" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition">Vendor Login →</a>
      </header>

      {/* RADAR CONSOLE */}
      <section className="max-w-5xl mx-auto bg-gray-900 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden mb-12">
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Find Vinyl Records Near You</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">Lock onto local independent sellers, view their exact distance, and browse their pristine crates before you drive.</p>
          
          <button 
            onClick={handleScanRadar} 
            disabled={scanning}
            className="bg-emerald-500 hover:bg-emerald-400 text-gray-900 px-8 py-4 rounded-full font-bold text-lg transition shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-70 disabled:scale-95 flex items-center justify-center mx-auto gap-3"
          >
            {scanning ? (
              <>
                <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-200 opacity-75"></span>
                Pinging Satellite...
              </>
            ) : (
              'Scan Local Radar 🎯'
            )}
          </button>
          
          {errorMsg && <p className="text-red-400 mt-4 font-medium">{errorMsg}</p>}
        </div>
      </section>

      {/* STOREFRONT RESULTS */}
      <section className="max-w-5xl mx-auto">
        {!scanning && stores.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <div key={store.store_id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-xl text-gray-900">{store.store_name}</h3>
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md">{store.distance_miles.toFixed(1)} mi</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{store.store_bio || "Independent local vinyl seller."}</p>
                </div>
                
                <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-500">{store.active_records.length} Records</span>
                  <button 
                    onClick={() => setSelectedStore(store)}
                    className="text-emerald-600 font-bold text-sm hover:text-emerald-700 transition flex items-center gap-1"
                  >
                    Open Crate →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!scanning && stores.length === 0 && !errorMsg && (
          <div className="text-center text-gray-400 py-12">
            Radar is standing by. Click scan to locate nearby vinyl records.
          </div>
        )}
      </section>

      {/* THE CRATE MODAL (Frictionless Browsing) */}
      {selectedStore && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedStore.store_name}</h3>
                <p className="text-sm text-gray-500">{selectedStore.distance_miles.toFixed(1)} miles away</p>
              </div>
              <button 
                onClick={() => setSelectedStore(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Inventory List */}
            <div className="p-6 overflow-y-auto bg-white flex-1">
              {selectedStore.active_records.length === 0 ? (
                <p className="text-center text-gray-400 italic">This crate is currently empty.</p>
              ) : (
                <div className="space-y-4">
                  {selectedStore.active_records.map((record) => (
                    <div key={record.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:border-emerald-200 transition">
                      <div>
                        <h4 className="font-bold text-gray-900">{record.title}</h4>
                        <p className="text-sm text-gray-500">{record.artist}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{record.weight_grams}g</span>
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Grade: {record.condition || 'New'}</span>
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Qty: {record.quantity}</span>
                            {/* NEW LOCATION TAG */}
                            {record.location && (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                                Loc: {record.location}
                              </span>
                            )}
                          </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-emerald-600">${(record.price_cents / 100).toFixed(2)}</div>
                        <button className="mt-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition">Reserve</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
