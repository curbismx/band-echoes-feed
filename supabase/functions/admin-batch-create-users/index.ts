// admin-batch-create-users edge function
// Batch-creates temporary/starter accounts with unique emails and marks profiles.created_by
// Requires caller to be authenticated and have admin role. Does NOT affect caller session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomPassword(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+={}[]";
  let pass = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) pass += chars[arr[i] % chars.length];
  return pass;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "admin-batch-create-users healthy" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: getUserError } = await authClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized - please log in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin, error: roleErr } = await serviceClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr) {
      return new Response(JSON.stringify({ error: `Role check failed: ${roleErr.message}` }), {
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

    const body = await req.json();
    const count = Math.min(100, Math.max(1, Number(body?.count ?? 30)));
    const prefix = String(body?.prefix ?? "starter").trim() || "starter";
    const domain = String(body?.domain ?? "example.com").trim() || "example.com";

    const ts = Date.now();
    const created: Array<{ user_id: string; email: string; username: string }> = [];
    const failed: Array<{ index: number; reason: string }> = [];

    for (let i = 1; i <= count; i++) {
      const username = `${prefix}-${String(i).padStart(3, "0")}`;
      const email = `${prefix}-${ts}-${i}@${domain}`.toLowerCase();
      const password = randomPassword(18);

      const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: username,
        },
      });

      if (createError) {
        // If duplicate or any other creation error, record and continue
        failed.push({ index: i, reason: createError.message || "unknown" });
        continue;
      }

      const uid = createdUser.user?.id;
      if (!uid) {
        failed.push({ index: i, reason: "no user id returned" });
        continue;
      }

      // Mark profile ownership and persist email for easy listing
      await serviceClient
        .from("profiles")
        .update({ created_by: userRes.user.id, email })
        .eq("id", uid);

      created.push({ user_id: uid, email, username });
    }

    return new Response(
      JSON.stringify({ created_count: created.length, failed_count: failed.length, created, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as any)?.message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
