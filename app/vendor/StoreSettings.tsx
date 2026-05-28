"use client";

import { useState, useEffect } from 'react';
import { updateVendorProfile, getVendorProfile } from '../services/vendorService';

export default function StoreSettings({ userId }: { userId: string }) {
  const [storeName, setStoreName] = useState('');
  const [storeBio, setStoreBio] = useState('');
  const [status, setStatus] = useState('');
  
  // GPS State
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState('Location not set');

  useEffect(() => {
    async function loadProfile() {
      const profile = await getVendorProfile(userId);
      if (profile) {
        setStoreName(profile.store_name || '');
        setStoreBio(profile.store_bio || '');
        if (profile.location) {
          setLocationStatus('📍 Store is pinned on the map');
        }
      }
    }
    loadProfile();
  }, [userId]);

  const handleGetLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocationStatus('Locating satellites...');
    
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLon(position.coords.longitude);
        setLocationStatus(`📍 Coordinates Locked: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
      },
      (error) => {
        setLocationStatus('Permission denied. Please allow location access.');
      }
    );
  };

  const handleSave = async () => {
    setStatus('Saving...');
    const success = await updateVendorProfile(userId, storeName, storeBio, lat, lon);
    setStatus(success ? 'Vinyl records secured and mapped!' : 'Error saving profile.');
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md mb-8 border border-gray-100">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Store Profile & Radar Setup</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Store Name</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
            placeholder="e.g., Joe's Jazz Vault"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Store Bio</label>
          <textarea
            value={storeBio}
            onChange={(e) => setStoreBio(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-gray-900"
            rows={3}
            placeholder="Specializing in pristine Audio Note worthy pressings..."
          />
        </div>

        {/* New Radar Coordinates Section */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Radar Coordinates</h3>
            <p className={`text-xs mt-1 font-medium ${locationStatus.includes('Locked') || locationStatus.includes('pinned') ? 'text-emerald-600' : 'text-gray-500'}`}>
              {locationStatus}
            </p>
          </div>
          <button 
            onClick={handleGetLocation}
            className="text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded shadow-sm transition"
          >
            Pin My Location
          </button>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors font-bold shadow-md"
          >
            Save Store Settings
          </button>
          {status && <span className="text-sm text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-md">{status}</span>}
        </div>
      </div>
    </div>
  );
}
