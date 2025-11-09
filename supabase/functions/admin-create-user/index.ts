// admin-create-user edge function
// Creates users without changing the caller's session. Requires caller to be an authenticated admin.
// Deno runtime
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers required for browser calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "admin-create-user function is healthy" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    console.error(`Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("=== User Creation Request Started ===");
    const authHeader = req.headers.get("Authorization") || "";

    // Client-scoped auth to read the caller's user
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log("Checking caller authentication...");
    const { data: userRes, error: getUserError } = await authClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      console.error("Auth check failed:", getUserError);
      return new Response(JSON.stringify({ error: "Unauthorized - please log in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("✓ Caller authenticated:", userRes.user.id);

    // Service client for privileged operations
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin role using security definer function
    console.log("Verifying admin role...");
    const { data: isAdmin, error: roleErr } = await serviceClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (roleErr) {
      console.error("Role check error:", roleErr);
      return new Response(JSON.stringify({ error: `Role check failed: ${roleErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isAdmin) {
      console.error("User is not admin:", userRes.user.id);
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("✓ Admin verified");

    const body = await req.json();
    const { email, password, username, display_name } = body || {};
    console.log("Request data:", { email, username, display_name, hasPassword: !!password });

    if (!email || !password) {
      console.error("Missing required fields:", { hasEmail: !!email, hasPassword: !!password });
      return new Response(JSON.stringify({ error: "email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Creating user with admin.createUser...");
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username ?? null,
        display_name: display_name ?? null,
      },
    });

    if (createError) {
      console.error("User creation failed:", createError);
      return new Response(JSON.stringify({ error: `Failed to create user: ${createError.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✓ User created successfully:", created.user?.id);
    return new Response(
      JSON.stringify({ user_id: created.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error in admin-create-user:", e);
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${(e as any)?.message || "Unknown error"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
