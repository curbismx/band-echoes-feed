import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, artist } = await req.json();
    
    if (!title || title.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse title if it's in "Artist - Track" format
    let artistName = artist || '';
    let trackName = title;
    
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) {
        artistName = parts[0].trim();
        trackName = parts.slice(1).join(' - ').trim(); // In case track name also has " - "
      }
    }

    console.log('Searching for:', trackName, 'by', artistName);

    // Use iTunes Search API with better search query
    const searchQuery = artistName ? `${trackName} ${artistName}` : trackName;
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=5`;
    
    const itunesResponse = await fetch(itunesUrl);
    const itunesData = await itunesResponse.json();

    if (!itunesData.results || itunesData.results.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No results found',
          links: {}
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find the best match if we have artist name
    let track = itunesData.results[0];
    if (artistName) {
      // Look for a result where artist name matches more closely
      const artistLower = artistName.toLowerCase();
      const trackLower = trackName.toLowerCase();
      
      const betterMatch = itunesData.results.find((result: any) => {
        const resultArtist = (result.artistName || '').toLowerCase();
        const resultTrack = (result.trackName || '').toLowerCase();
        return resultArtist.includes(artistLower) || artistLower.includes(resultArtist) ||
               (resultTrack.includes(trackLower) || trackLower.includes(resultTrack));
      });
      
      if (betterMatch) {
        track = betterMatch;
      }
    }
    
    const foundTrackName = track.trackName || trackName;
    const foundArtistName = track.artistName || artistName;
    const appleMusicUrl = track.trackViewUrl || '';

    console.log('Found track:', foundTrackName, 'by', foundArtistName);

    // Construct search URLs for other platforms using found track info
    const searchTerm = encodeURIComponent(`${foundTrackName} ${foundArtistName}`.trim());
    
    const links = {
      apple_music: appleMusicUrl,
      spotify: `https://open.spotify.com/search/${searchTerm}`,
      tidal: `https://listen.tidal.com/search?q=${searchTerm}`,
      youtube_music: `https://music.youtube.com/search?q=${searchTerm}`,
    };

    console.log('Generated links:', links);

    return new Response(
      JSON.stringify({ 
        success: true,
        track_name: foundTrackName,
        artist_name: foundArtistName,
        links 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error finding music links:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to find music links' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
