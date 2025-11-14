import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get('file');

    if (!filename) {
      return new Response(
        JSON.stringify({ error: 'Missing file parameter' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the video file from storage
    const { data, error } = await supabase.storage
      .from('videos')
      .download(filename);

    if (error || !data) {
      console.error('Storage error:', error);
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get file size for Content-Length
    const fileSize = data.size;

    // Check if client requested a range
    const rangeHeader = req.headers.get('range');
    
    if (rangeHeader) {
      // Parse range header (e.g., "bytes=0-1023")
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        // Get the requested chunk
        const arrayBuffer = await data.arrayBuffer();
        const chunk = arrayBuffer.slice(start, end + 1);

        return new Response(chunk, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }

    // Return full file if no range requested
    return new Response(data, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Stream video error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
