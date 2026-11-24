export function useIsolatedVersionedSync({ development, requested, supabaseUrl }) {
  if (development !== true || requested !== "true" || typeof supabaseUrl !== "string") return false;
  try {
    const url = new URL(supabaseUrl);
    return (url.protocol === "http:" || url.protocol === "https:") && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
