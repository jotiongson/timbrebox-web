"use client";

import { useState, useEffect } from 'react';
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
  cover_image?: string; // Prepared for future image support
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
  
  // NEW STATE: Tracks which record the user is currently inspecting
  const [inspectingRecord, setInspectingRecord] = useState<VinylRecord | null>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);

  // FETCH GALLERY IMAGES WHEN INSPECTOR OPENS
  useEffect(() => {
    if (inspectingRecord) {
      const fetchImages = async () => {
        const { data } = await supabase
          .from('record_images')
          .select('*')
          .eq('record_id', inspectingRecord.id)
          .order('created_at', { ascending: true });
        
        setGalleryImages(data || []);
      };
      fetchImages();
    } else {
      setGalleryImages([]); // Clear when modal closes
    }
  }, [inspectingRecord]);

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
      
      // 🚀 THE BULLETPROOF FILTER:
      // 1. Strip out any records where price is 0 or less
      // 2. Hide any stores that have 0 records left to sell
      const filteredStores = (data || [])
        .map((store: Store) => ({
          ...store,
          active_records: store.active_records.filter(record => record.price_cents > 0)
        }))
        .filter((store: Store) => store.active_records.length > 0);

      setStores(filteredStores);
    } catch (err: any) {
      console.error('Radar failure:', err.message);
      setErrorMsg('Supabase Error: ' + err.message); 
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
                    Browse Collection →
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

      {/* THE COLLECTION MODAL */}
      {selectedStore && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedStore.store_name}</h3>
                <p className="text-xs sm:text-sm text-gray-500">{selectedStore.distance_miles.toFixed(1)} miles away</p>
              </div>
              <button 
                onClick={() => setSelectedStore(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center font-bold transition"
              >
                ✕
              </button>
            </div>
            
            {/* Modal Inventory List */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-gray-50/50 flex-1">
              {selectedStore.active_records.length === 0 ? (
                <p className="text-center text-gray-400 italic">This collection is currently empty.</p>
              ) : (
                <div className="space-y-3">
                  {selectedStore.active_records.map((record) => (
                    <div key={record.id} className="border border-gray-100 rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-4 items-center hover:border-emerald-200 hover:shadow-md transition bg-white cursor-pointer group" onClick={() => setInspectingRecord(record)}>
                      
                      {/* Album Thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center shadow-sm group-hover:shadow transition">
                        {record.cover_image ? (
                          <img src={record.cover_image} alt={record.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl opacity-30">💿</span>
                        )}
                      </div>

                      {/* Info Panel */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm sm:text-base truncate">{record.title}</h4>
                        <p className="text-xs sm:text-sm text-gray-500 truncate mb-1.5">{record.artist}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{record.weight_grams}g</span>
                          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">Grade: {record.condition || 'New'}</span>
                          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Qty: {record.quantity}</span>
                        </div>
                      </div>

                      {/* Action Panel */}
                      <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                        <div className="font-black text-base sm:text-lg text-emerald-600 mb-1.5">${(record.price_cents / 100).toFixed(2)}</div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setInspectingRecord(record); }}
                          className="bg-gray-900 group-hover:bg-emerald-600 text-white text-[10px] sm:text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition shadow-sm"
                        >
                          Inspect
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- THE RECORD INSPECTOR MODAL --- */}
      {inspectingRecord && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-8">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row shadow-2xl overflow-hidden animate-fade-in relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setInspectingRecord(null)}
              className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg transition"
            >
              ✕
            </button>

            {/* Left Column: Album Art */}
            <div className="md:w-5/12 bg-gray-100 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-gray-200 min-h-[250px] relative">
              {inspectingRecord.cover_image ? (
                <img src={inspectingRecord.cover_image} alt="Album Cover" className="w-full h-auto object-cover rounded-xl shadow-lg" />
              ) : (
                <div className="text-center">
                  <div className="text-8xl mb-4 opacity-30">💿</div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Cover Scan</p>
                </div>
              )}
            </div>

            {/* Right Column: Specs & Collector's Corner */}
            <div className="md:w-7/12 p-6 md:p-8 overflow-y-auto bg-white flex flex-col">
              
              {/* Header Info */}
              <div className="mb-6">
                <h3 className="text-3xl font-black text-gray-900 leading-tight tracking-tight mb-1">{inspectingRecord.title}</h3>
                <p className="text-lg font-medium text-gray-500">{inspectingRecord.artist}</p>
              </div>

              {/* Core Specs Grid */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Asking Price</p>
                  <p className="text-2xl font-black text-emerald-600">${(inspectingRecord.price_cents / 100).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Media Grade</p>
                  <p className="text-2xl font-black text-gray-900">{inspectingRecord.condition || 'Unknown'}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Vinyl Weight</p>
                  <p className="text-lg font-bold text-gray-900">{inspectingRecord.weight_grams}g</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Availability</p>
                  <p className="text-lg font-bold text-gray-900">{inspectingRecord.quantity} in stock</p>
                </div>
              </div>

              {/* The Collector's Corner */}
              <div className="mt-auto border-t border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-gray-900 text-white text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded">Collector's Corner</span>
                  <span className="text-xs font-semibold text-gray-400">Visual Verification</span>
                </div>
                
                <div className="bg-gray-900 rounded-xl p-5 text-left border border-gray-800 shadow-inner">
                  
                  {/* DYNAMIC SWIPEABLE GALLERY */}
                  {galleryImages.length === 0 ? (
                    <div className="w-full h-24 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 bg-gray-800/50">
                      <span className="text-xl mb-1">🔍</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest">Awaiting Verification Photos</span>
                    </div>
                  ) : (
                    <div 
                      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" 
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {galleryImages.map((img, i) => (
                        <div key={img.id} className="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40 snap-center rounded-lg overflow-hidden border border-gray-700 bg-gray-800 relative group">
                          <img src={img.image_url} alt={`Gallery view ${i+1}`} className="w-full h-full object-cover" />
                          
                          {/* THE NEW PHOTO TAG BADGE */}
                          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-2 pb-4 px-2 pointer-events-none">
                            <span className="text-emerald-400 text-[9px] font-black uppercase tracking-widest drop-shadow-md">
                              {img.caption || 'Gallery Photo'}
                            </span>
                          </div>
                          
                          {/* Hover Overlay for High-Res Viewing */}
                          <a 
                            href={img.image_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                          >
                            <span className="text-white text-xs font-bold uppercase tracking-wider bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-600">
                              🔍 Full Size
                            </span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </main>
  );
}
