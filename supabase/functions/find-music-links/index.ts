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

    console.log('Searching for:', title, artist || '');

    // Use iTunes Search API (free, no auth needed)
    const searchQuery = artist ? `${title} ${artist}` : title;
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&entity=song&limit=1`;
    
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

    const track = itunesData.results[0];
    const trackName = track.trackName || title;
    const artistName = track.artistName || artist || '';
    const appleMusicUrl = track.trackViewUrl || '';

    console.log('Found track:', trackName, 'by', artistName);

    // Construct search URLs for other platforms
    const searchTerm = encodeURIComponent(`${trackName} ${artistName}`.trim());
    
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
        track_name: trackName,
        artist_name: artistName,
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
