"use server";

import { supabase } from "../supabase";

// Trace Helper: Using Date.now() and loud terminal logging
async function writeTelemetryLog(type: string, value: string, isHit: boolean, startTime: number) {
  try {
    const duration = Math.round(Date.now() - startTime);
    const safeValue = value.length > 100 ? value.substring(0, 97) + "..." : value;
    
    console.log(`[Telemetry] Attempting insert -> Type: ${type} | Hit: ${isHit} | Duration: ${duration}ms`);

    const { error } = await supabase.from('api_call_logs').insert([{
      query_type: type,
      query_value: safeValue, 
      cache_hit: isHit,
      execution_duration_ms: duration
    }]);

    if (error) {
      console.error("🚨 [Telemetry Insert Blocked by Supabase]:", error.message, error.details);
    } else {
      console.log("[Telemetry] ✅ Successfully written to api_call_logs");
    }
  } catch (err) {
    console.error("🚨 [Telemetry Execution Crash]:", err);
  }
}

function extractWeightFromFormats(formats: any[]): string {
  if (!formats || formats.length === 0) return '';
  const format = formats[0];
  const descriptions = format.descriptions || [];
  const text = format.text || ""; 
  const combinedText = [...descriptions, text].join(" ").toLowerCase();
  const weightMatch = combinedText.match(/(\d+)\s*(g|gram)/);
  if (weightMatch) return weightMatch[1]; 
  return '';
}

async function checkCache(queryType: string, queryValue: string) {
  const { data, error } = await supabase
    .from('discogs_cache')
    .select('discogs_data')
    .eq('query_type', queryType)
    .eq('query_value', queryValue)
    .single();
    
  if (error && error.code !== 'PGRST116') { 
     console.error("🚨 [Cache Check Error]:", error.message);
  }
  if (data) return data.discogs_data;
  return null;
}

async function setCache(queryType: string, queryValue: string, payload: any) {
  const { error } = await supabase.from('discogs_cache').insert([{
    query_type: queryType,
    query_value: queryValue,
    discogs_data: payload
  }]);

  if (error) {
    console.error("🚨 [Cache Insert Blocked by Supabase]:", error.message);
  }
}

export async function searchDiscogsByBarcode(barcode: string) {
  const telemetryStart = Date.now();
  const cachedData = await checkCache('barcode', barcode);
  
  if (cachedData) {
    await writeTelemetryLog('barcode', barcode, true, telemetryStart);
    return cachedData;
  }

  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  const searchUrl = `https://api.discogs.com/database/search?barcode=${barcode}&type=release&token=${token}`;

  try {
    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });

    if (!searchResponse.ok) throw new Error(`Status: ${searchResponse.status}`);
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

      const payload = {
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

      await setCache('barcode', barcode, payload);
      await writeTelemetryLog('barcode', barcode, false, telemetryStart);
      return payload;
    }
    
    await writeTelemetryLog('barcode', `${barcode} (Not Found)`, false, telemetryStart);
    return { error: "No records found for this barcode." };
  } catch (error: any) {
    console.error("[Discogs] API Error:", error.message);
    return { error: "Failed to communicate with Discogs API." };
  }
}

export async function searchDiscogsByText(query: string) {
  const telemetryStart = Date.now();
  const cachedData = await checkCache('text_search', query);
  
  if (cachedData) {
    await writeTelemetryLog('text_search', query, true, telemetryStart);
    return cachedData;
  }

  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=20&token=${token}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const data = await response.json();
    
    const mappedResults = (data.results || []).map((res: any) => ({
      ...res,
      lowest_price: res.lowest_price || null 
    }));

    const payload = { success: true, results: mappedResults };
    await setCache('text_search', query, payload);
    await writeTelemetryLog('text_search', query, false, telemetryStart);
    return payload;

  } catch (error: any) {
    console.error("[Discogs] Text Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}

export async function getDiscogsReleaseDetails(releaseId: number) {
  const telemetryStart = Date.now();
  const cachedData = await checkCache('release_details', releaseId.toString());
  
  if (cachedData) {
    await writeTelemetryLog('release_details', releaseId.toString(), true, telemetryStart);
    return cachedData;
  }

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
    
    const payload = {
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

    await setCache('release_details', releaseId.toString(), payload);
    await writeTelemetryLog('release_details', releaseId.toString(), false, telemetryStart);
    return payload;

  } catch (error: any) {
    console.error("[Discogs] Release Details Error:", error.message);
    return { error: "Failed to fetch release details." };
  }
}

export async function searchDiscogsByCatalogNumber(catno: string) {
  const telemetryStart = Date.now();
  const cachedData = await checkCache('catalog', catno);
  
  if (cachedData) {
    await writeTelemetryLog('catalog', catno, true, telemetryStart);
    return cachedData;
  }

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
      const details = await getDiscogsReleaseDetails(data.results[0].id);
      
      if (details && details.success) {
        await setCache('catalog', catno, details);
      }
      await writeTelemetryLog('catalog', catno, false, telemetryStart);
      return details;
    }
    
    await writeTelemetryLog('catalog', `${catno} (Not Found)`, false, telemetryStart);
    return { error: "No records found for that catalog number." };
  } catch (error: any) {
    console.error("[Discogs] Catalog Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}

export async function fetchLiveCacheMetrics() {
  try {
    const { data, error } = await supabase.rpc('get_api_cache_metrics');
    if (error) throw error;
    return { success: true, metrics: data };
  } catch (error: any) {
    console.error("[RPC Metrics Error]:", error.message);
    return { success: false, error: error.message };
  }
}
