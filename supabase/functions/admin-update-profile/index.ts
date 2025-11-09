// admin-update-profile edge function
// Updates a user's profile and optionally uploads an avatar using service role
// Requires caller to be an authenticated admin
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function contentTypeFromExt(ext?: string) {
  switch ((ext || '').toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'admin-update-profile healthy' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';

    // Authenticated caller client
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: getUserError } = await authClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service client for privileged ops
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Ensure caller is admin
    const { data: isAdmin, error: roleErr } = await serviceClient.rpc('has_role', {
      _user_id: userRes.user.id,
      _role: 'admin',
    });
    if (roleErr) {
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { user_id, bio, avatar_base64, avatar_ext } = body || {};

    if (!user_id || typeof user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let avatar_url: string | null | undefined = undefined;

    if (avatar_base64 && typeof avatar_base64 === 'string') {
      // Limit ~10MB
      const maxLen = 10 * 1024 * 1024 * 4 / 3; // base64 overhead
      if (avatar_base64.length > maxLen) {
        return new Response(JSON.stringify({ error: 'Avatar too large (max 10MB)' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const binary = atob(avatar_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const path = `${user_id}/avatar.${(avatar_ext || 'jpg').toLowerCase()}`;
      const { error: uploadError } = await serviceClient.storage
        .from('avatars')
        .upload(path, bytes, {
          upsert: true,
          contentType: contentTypeFromExt(avatar_ext),
        });
      if (uploadError) {
        return new Response(JSON.stringify({ error: uploadError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: pub } = serviceClient.storage.from('avatars').getPublicUrl(path);
      avatar_url = pub.publicUrl;
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof bio === 'string') updatePayload.bio = bio;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;

    if (Object.keys(updatePayload).length > 0) {
      const { error: profileError } = await serviceClient
        .from('profiles')
        .update(updatePayload)
        .eq('id', user_id);
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, avatar_url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
