"use server";

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

export async function searchDiscogsByBarcode(barcode: string) {
  const token = process.env.DISCOGS_PAT;

  if (!token) {
    console.error("[Discogs] Token missing from environment variables.");
    return { error: "Server configuration error." };
  }

  // type=release ensures we don't get abstract Master records
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

      return {
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
    }
    return { error: "No records found for this barcode." };
  } catch (error: any) {
    console.error("[Discogs] API Error:", error.message);
    return { error: "Failed to communicate with Discogs API." };
  }
}

export async function searchDiscogsByText(query: string) {
  const token = process.env.DISCOGS_PAT;
  if (!token) return { error: "Server configuration error." };

  // type=release ensures pricing is available on the items returned
  const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=20&token=${token}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    
    // Map the results to ensure lowest_price is explicitly available
    const mappedResults = (data.results || []).map((res: any) => {
       return {
         ...res,
         lowest_price: res.lowest_price || null 
       }
    });

    return { success: true, results: mappedResults };
  } catch (error: any) {
    console.error("[Discogs] Text Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}

export async function getDiscogsReleaseDetails(releaseId: number) {
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
    
    return {
      success: true,
      artist: cleanArtist,
      title: data.title || 'Unknown Title',
      year: data.year || null,
      genres: data.genres || [],
      cover_image: data.images && data.images.length > 0 ? data.images[0].uri : null,
      tracklist: data.tracklist || [],
      identifiers: data.identifiers || [], 
      formats: data.formats || [], // Passes formats back for UI overrides
      weight: extractedWeight,
      market_price: data.lowest_price || null 
    };
  } catch (error: any) {
    console.error("[Discogs] Release Details Error:", error.message);
    return { error: "Failed to fetch release details." };
  }
}

export async function searchDiscogsByCatalogNumber(catno: string) {
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
      return await getDiscogsReleaseDetails(data.results[0].id);
    }
    return { error: "No records found for that catalog number." };
  } catch (error: any) {
    console.error("[Discogs] Catalog Search Error:", error.message);
    return { error: "Failed to search Discogs API." };
  }
}
