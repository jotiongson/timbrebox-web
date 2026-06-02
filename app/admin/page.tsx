"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from "../supabase"; 
import { fetchAdminVendorMetrics } from "../services/discogsService";
import Link from "next/link";

export default function AdminDashboard() {
  const router = useRouter();
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAuthAndLoad() {
      // 1. Check if user has an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // 2. Query the database to verify if this specific user has the admin flag
      const { data: profile, error } = await supabase
        .from('vendor_profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (error || !profile?.is_admin) {
        alert("Access Denied: Admin privileges required.");
        router.push('/vendor'); // Boot normal vendors back to their regular dashboard
        return;
      }

      setIsAdmin(true);

      // 3. User is authorized, safely load global network metrics
      const res = await fetchAdminVendorMetrics();
      if (res?.success && res.report) {
        setReport(res.report);
      }
      setLoading(false);
    }

    checkAuthAndLoad();
  }, [router]);

  // Prevent UI flashing while checking authentication
  if (!isAdmin && loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 bg-gray-50">Verifying Admin Credentials...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-12 font-sans text-gray-900">
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-red-600 uppercase tracking-widest bg-red-50 border border-red-100 px-2.5 py-1 rounded-md w-fit mb-2">
            <span>🛡️ Global Operations Monitoring</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">TimbreBox Network Control</h1>
        </div>
        <Link href="/vendor" className="text-sm font-bold text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition">
          ← Return to Dashboard
        </Link>
      </header>

      <section className="max-w-6xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-black text-lg">Vendor Traffic Breakdown</h2>
          <p className="text-xs text-gray-400 font-medium">Real-time cache utilization across all stores.</p>
        </div>

        {loading ? (
          <div className="p-16 text-center text-gray-400 font-bold animate-pulse">Aggregating node telemetry...</div>
        ) : report.length === 0 ? (
          <div className="p-16 text-center text-gray-400 font-medium">No system metrics logs populated yet.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="px-6 py-4">Store Profile Name</th>
                  <th className="px-6 py-4 text-center">Total Requests Hit</th>
                  <th className="px-6 py-4 text-center">Deflected Hits</th>
                  <th className="px-6 py-4 text-center">Discogs API Costs</th>
                  <th className="px-6 py-4 text-right">Shield Protection Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-sm">
                {report.map((shop) => (
                  <tr key={shop.vendor_id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 font-bold text-gray-900">{shop.store_name}</td>
                    <td className="px-6 py-4 text-center font-bold text-gray-700">{shop.total_requests}</td>
                    <td className="px-6 py-4 text-center text-emerald-600 font-bold">{shop.cache_hits}</td>
                    <td className="px-6 py-4 text-center text-amber-600 font-bold">{shop.api_misses}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black ${
                        shop.efficiency_pct > 80 ? 'bg-emerald-100 text-emerald-800' :
                        shop.total_requests === 0 ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-800'
                      }`}>
                        {shop.efficiency_pct}% Shielded
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
