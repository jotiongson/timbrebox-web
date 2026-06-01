"use server";

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS for server-side cache management
// Ensure these environment variables are set in your .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Cache Helper Functions ---

async function getCachedData(queryType: string, queryValue: string) {
  try {
    const { data, error } = await supabase
      .from('discogs_cache')
      .select('discogs_data')
      .eq('query_type', queryType)
      .eq('query_value', queryValue)
      .order('created_at', { ascending: false }) // Get the most recent entry if duplicates exist
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is an expected cache miss
      console.warn(`[Cache] Error reading ${queryType}:${queryValue}:`, error.message);
    }
    return data ? data.discogs_data : null;
  } catch (err) {
    console.error(`[Cache] Exception reading ${queryType}:${queryValue}:`, err);
    return null;
  }
}

async function setCachedData(queryType: string, queryValue: string, payload: any) {
  try {
    const { error } = await supabase
      .from('discogs_cache')
      .insert({ 
        query_type: queryType, 
        query_value: queryValue, 
        discogs_data: payload 
      });

    if (error) {
      console.warn(`[Cache] Error writing ${queryType}:${queryValue}:`, error.message);
    }
  } catch (err) {
    console.error(`[Cache] Exception writing ${queryType}:${queryValue}:`, err);
  }
}

// --- Discogs Helper Functions ---

// Helper function to dig through Discogs format quirks and find the weight
function extractWeightFromFormats(formats: any[]): string {
  if (!formats || formats.length === 0) return '';
  
  const format = formats[0];
  const descriptions = format.descriptions || [];
  const text = format.text || ""; // This is where "200 gram" was hiding!

  // Combine descriptions and text into one single lowercase string
  const combinedText = [...descriptions, text].join(" ").toLowerCase();

  // Look for a number immediately followed by "g" or "gram" (e.g., "200g", "180 gram")
  const weightMatch = combinedText.match(/(\d+)\s*(g|gram)/);
  
  if (weightMatch) {
    return weightMatch[1]; // Returns just the number (e.g., "200")
  }
  
  return '';
}

// --- Exported API Functions ---

export async function searchDiscogsByBarcode(barcode: string) {
  const queryType = 'barcode';
  const queryValue = barcode;
  
  const cached = await getCachedData(queryType, queryValue);
  if (cached) return cached;

  const token = process.env.DISCOGS_PAT;
  if (!token) {
    console.error("[Discogs] Token missing from environment variables.");
    return { error: "Server configuration error." };
  }

  const searchUrl = `https://api.discogs.com/database/search?barcode=${barcode}&type=release&token=${token}`;

  try {
    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });

    if (!searchResponse.ok) throw new Error(`Discogs Search API responded with status: ${searchResponse.status}`);

    const searchData = await searchResponse.json();

    if (searchData.results && searchData.results.length > 0) {
      const bestMatch = searchData.results[0];
      const releaseId = bestMatch.id;

      const titleParts = bestMatch.title.split(' - ');
      const artist = titleParts[0]?.trim() || 'Unknown Artist';
      const title = titleParts[1]?.trim() || bestMatch.title;

      const releaseUrl = `https://api.discogs.com/releases/${releaseId}?token=${token}`;
      const releaseResponse = await fetch(releaseUrl, {
        headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
      });

      let tracklist = [];
      let identifiers = [];
      let genres = bestMatch.genre || [];
      let year = bestMatch.year || null;
      let extractedWeight = '';
      let marketPrice = null; 

      if (releaseResponse.ok) {
        const releaseData = await releaseResponse.json();
        tracklist = releaseData.tracklist || [];
        identifiers = releaseData.identifiers || []; 
        year = releaseData.year || year;
        genres = releaseData.genres || genres;
        marketPrice = releaseData.lowest_price || null; 
        
        extractedWeight = extractWeightFromFormats(releaseData.formats);
      }

      const finalResult = {
        success: true,
        artist: artist,
        title: title,
        year: year,
        genres: genres,
        cover_image: bestMatch.cover_image || null,
        tracklist: tracklist,
        identifiers: identifiers, 
        weight: extractedWeight,
        market_price: marketPrice 
      };

      await setCachedData(queryType, queryValue, finalResult);
      return finalResult;
    }
    return { error: "No records found for this barcode." };
  } catch (error: any) {
    console.error("[Discogs] API Error:", error.message);
    return { error: "Failed to communicate with Discogs API." };
  }
}

export async function searchDiscogsByText(query: string) {
  const queryType = 'text_search';
  const queryValue = query.toLowerCase().trim();
  
  const cached = await getCachedData(queryType, queryValue);
  if (cached) return cached;

  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=20&token=${token}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    
    const mappedResults = (data.results || []).map((res: any) => {
       return {
         ...res,
         lowest_price: res.lowest_price || null 
       }
    });

    const finalResult = { success: true, results: mappedResults };
    await setCachedData(queryType, queryValue, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("[Discogs] Text Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}

export async function getDiscogsReleaseDetails(releaseId: number) {
  const queryType = 'release_details';
  const queryValue = releaseId.toString();

  const cached = await getCachedData(queryType, queryValue);
  if (cached) return cached;

  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  const url = `https://api.discogs.com/releases/${releaseId}?token=${token}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    
    const rawArtist = data.artists && data.artists.length > 0 ? data.artists[0].name : 'Unknown Artist';
    const cleanArtist = rawArtist.replace(/\s\(\d+\)$/, '');
    
    const extractedWeight = extractWeightFromFormats(data.formats);
    
    const finalResult = {
      success: true,
      artist: cleanArtist,
      title: data.title || 'Unknown Title',
      year: data.year || null,
      genres: data.genres || [],
      cover_image: data.images && data.images.length > 0 ? data.images[0].uri : null,
      tracklist: data.tracklist || [],
      identifiers: data.identifiers || [], 
      formats: data.formats || [], 
      weight: extractedWeight,
      market_price: data.lowest_price || null 
    };

    await setCachedData(queryType, queryValue, finalResult);
    return finalResult;
  } catch (error: any) {
    console.error("[Discogs] Release Details Error:", error.message);
    return { error: "Failed to fetch release details." };
  }
}

export async function searchDiscogsByCatalogNumber(catno: string) {
  const queryType = 'catalog';
  const queryValue = catno.toLowerCase().trim();

  const cached = await getCachedData(queryType, queryValue);
  if (cached) return cached;

  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  const searchUrl = `https://api.discogs.com/database/search?catno=${encodeURIComponent(catno)}&type=release&token=${token}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Re-use the existing release detail logic (which is also cached under 'release_details')
      const releaseDetails = await getDiscogsReleaseDetails(data.results[0].id);
      
      // Save the result mapped to this specific catalog number to skip the initial search jump next time
      if (releaseDetails && releaseDetails.success) {
        await setCachedData(queryType, queryValue, releaseDetails);
      }
      return releaseDetails;
    }
    return { error: "No records found for that catalog number." };
  } catch (error: any) {
    console.error("[Discogs] Catalog Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}
