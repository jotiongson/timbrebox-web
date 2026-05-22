"use server";

// The "use server" directive ensures this code ONLY runs on your secure backend.
// It will never leak your API token to the browser.

export async function searchDiscogsByBarcode(barcode: string) {
  const token = process.env.DISCOGS_PAT;

  if (!token) {
    console.error("[Discogs] Token missing from environment variables.");
    return { error: "Server configuration error." };
  }

  console.log(`[Discogs] Scanning barcode: ${barcode}...`);

  // STEP 1: The Shallow Search (Find the Release ID)
  const searchUrl = `https://api.discogs.com/database/search?barcode=${barcode}&token=${token}`;

  try {
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app'
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`Discogs Search API responded with status: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.results && searchData.results.length > 0) {
      // Grab the top match
      const bestMatch = searchData.results[0];
      const releaseId = bestMatch.id;

      // Discogs usually formats titles as "Artist Name - Album Title"
      const titleParts = bestMatch.title.split(' - ');
      const artist = titleParts[0]?.trim() || 'Unknown Artist';
      const title = titleParts[1]?.trim() || bestMatch.title;

      console.log(`[Discogs] Match found: ${artist} - ${title} (ID: ${releaseId})`);

      // STEP 2: The Deep Fetch (Get the Tracks and Videos)
      const releaseUrl = `https://api.discogs.com/releases/${releaseId}?token=${token}`;
      const releaseResponse = await fetch(releaseUrl, {
        headers: {
          'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app'
        }
      });

      let tracklist = [];
      let videos = [];
      let genres = bestMatch.genre || [];
      let year = bestMatch.year || null;

      if (releaseResponse.ok) {
        const releaseData = await releaseResponse.json();
        tracklist = releaseData.tracklist || [];
        videos = releaseData.videos || [];
        year = releaseData.year || year;
        genres = releaseData.genres || genres;
        console.log(`[Discogs] Deep fetch successful: Found ${tracklist.length} tracks and ${videos.length} videos.`);
      } else {
        console.warn(`[Discogs] Deep fetch failed for ID ${releaseId}, returning shallow data.`);
      }

      // Return the expanded payload to the frontend
      return {
        success: true,
        artist: artist,
        title: title,
        year: year,
        genres: genres,
        cover_image: bestMatch.cover_image || null,
        tracklist: tracklist,
        videos: videos
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

  // type=release and format=vinyl ensures we only get physical records, no CDs or cassettes
  const searchUrl = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&format=vinyl&per_page=10&token=${token}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app' }
    });
    
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const data = await response.json();
    return { success: true, results: data.results || [] };
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
    
    // Grab the first artist and strip out Discogs' database numbering (e.g., "Cannonball Adderley (2)")
    const rawArtist = data.artists && data.artists.length > 0 ? data.artists[0].name : 'Unknown Artist';
    const cleanArtist = rawArtist.replace(/\s\(\d+\)$/, '');
    
    return {
      success: true,
      artist: cleanArtist,
      title: data.title || 'Unknown Title',
      year: data.year || null,
      genres: data.genres || [],
      cover_image: data.images && data.images.length > 0 ? data.images[0].uri : null,
      tracklist: data.tracklist || [],
      videos: data.videos || []
    };
  } catch (error: any) {
    console.error("[Discogs] Release Details Error:", error.message);
    return { error: "Failed to fetch release details." };
  }
}