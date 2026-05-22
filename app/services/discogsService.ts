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

  // The official Discogs search endpoint
  const url = `https://api.discogs.com/database/search?barcode=${barcode}&token=${token}`;

  try {
    const response = await fetch(url, {
      headers: {
        // Discogs requires a descriptive User-Agent
        'User-Agent': 'TimbreBoxApp/1.0 +https://timbrebox-web.vercel.app'
      }
    });

    if (!response.ok) {
      throw new Error(`Discogs API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Grab the top match
      const bestMatch = data.results[0];
      
      // Discogs usually formats titles as "Artist Name - Album Title"
      const titleParts = bestMatch.title.split(' - ');
      const artist = titleParts[0]?.trim() || 'Unknown Artist';
      const title = titleParts[1]?.trim() || bestMatch.title;

      console.log(`[Discogs] Match found: ${artist} - ${title}`);

      return {
        success: true,
        artist: artist,
        title: title,
        year: bestMatch.year,
        thumb: bestMatch.thumb // We can use this tiny image in the UI later!
      };
    }

    return { success: false, error: "No records found for that barcode." };

  } catch (err: any) {
    console.error(`[Discogs] Fetch failure: ${err.message}`);
    return { success: false, error: "Failed to connect to Discogs." };
  }
}