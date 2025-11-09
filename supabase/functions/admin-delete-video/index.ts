// admin-delete-video edge function
// Deletes a video (row and storage object) using service role after verifying caller is admin
// Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractStoragePathFromPublicUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    // Expected format: .../storage/v1/object/public/videos/<path>
    const marker = "/videos/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  } catch {
    return null;
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", message: "admin-delete-video healthy" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";

    // Authenticated caller client
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: getUserError } = await authClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Ensure caller is admin
    const { data: isAdmin, error: roleErr } = await serviceClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr) {
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { video_id } = await req.json();
    if (!video_id || typeof video_id !== "string") {
      return new Response(JSON.stringify({ error: "video_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch video info (to delete storage object)
    const { data: video, error: selErr } = await serviceClient
      .from("videos")
      .select("id, video_url")
      .eq("id", video_id)
      .maybeSingle();

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort storage removal
    const storagePath = extractStoragePathFromPublicUrl(video?.video_url);
    if (storagePath) {
      await serviceClient.storage.from("videos").remove([storagePath]);
    }

    // Delete DB row
    const { error: delErr } = await serviceClient.from("videos").delete().eq("id", video_id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as any)?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
