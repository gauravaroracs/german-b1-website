import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey || !openAiKey) {
    return json(503, { error: "Hosted AI is not configured. Sign in and configure the Supabase AI function secrets." });
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Sign in to use hosted AI." });

  let payload: { messages?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Request body must be valid JSON." });
  }
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) {
    return json(400, { error: "Send between 1 and 30 messages." });
  }
  const safeMessages = [];
  let totalCharacters = 0;
  for (const message of messages) {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      return json(400, { error: "Each message needs a supported role and text content." });
    }
    totalCharacters += message.content.length;
    safeMessages.push({ role: message.role, content: message.content });
  }
  if (totalCharacters > 40000) return json(413, { error: "This AI request is too long. Shorten the text and try again." });

  const monthlyLimit = Number(Deno.env.get("AI_MONTHLY_REQUEST_LIMIT") || "120");
  if (!Number.isInteger(monthlyLimit) || monthlyLimit < 1 || monthlyLimit > 10000) {
    return json(503, { error: "AI_MONTHLY_REQUEST_LIMIT must be an integer from 1 to 10000." });
  }
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const period = monthStart.toISOString().slice(0, 10);
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: reservation, error: reserveError } = await serviceClient
    .rpc("reserve_deutsch_meister_ai_request", {
      p_user_id: authData.user.id,
      p_month_start: period,
      p_monthly_limit: monthlyLimit,
    })
    .maybeSingle();
  if (reserveError) return json(503, { error: "AI usage tracking is not ready. Apply supabase/schema.sql and try again." });
  if (!reservation) return json(429, { error: `Monthly AI limit reached (${monthlyLimit} requests). Try again next month.` });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
      messages: safeMessages,
      temperature: 0.7,
      max_tokens: 1400,
    }),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    if (response.status === 429) return json(503, { error: "The AI provider is busy or its account limit was reached. Try again later." });
    return json(502, { error: details.error?.message || "The AI provider could not complete this request." });
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return json(502, { error: "The AI provider returned an empty response." });
  return json(200, {
    content,
    usage: { requestCount: reservation.request_count, remaining: reservation.remaining },
  });
});
