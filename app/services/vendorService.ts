import { supabase } from '../supabase'; 

export async function getVendorProfile(userId: string) {
  const { data, error } = await supabase
    .from('vendor_profiles')
    .select('store_name, store_bio, location')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error(`[Vendor Service] Failed to retrieve profile: ${error.message}`);
    return null;
  }
  return data;
}

export async function updateVendorProfile(
  userId: string, 
  storeName: string, 
  storeBio: string, 
  lat: number | null, 
  lon: number | null
) {
  // Construct the payload
  const payload: any = { 
    id: userId, 
    store_name: storeName, 
    store_bio: storeBio 
  };

  // If coordinates exist, save both PostGIS format AND raw float values
  if (lat && lon) {
    payload.location = `POINT(${lon} ${lat})`;
    payload.lat = lat;
    payload.lon = lon;
  }

  const { error } = await supabase
    .from('vendor_profiles')
    .upsert(payload);

  if (error) {
    console.error(`[Vendor Service] Failed to save profile: ${error.message}`);
    return false;
  }
  return true;
}
