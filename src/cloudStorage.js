import { supabase, isSupabaseConfigured } from "./supabaseClient";

let userId = null;
let lastCloudError = "";
const LOCAL_ONLY_KEYS = new Set(["openai-api-key"]);

export function setCloudStorageUser(nextUserId) {
  userId = nextUserId || null;
}

export function getCloudStorageStatus() {
  return {
    configured: isSupabaseConfigured,
    connected: Boolean(isSupabaseConfigured && userId),
    lastError: lastCloudError,
  };
}

export function createCloudBackedStorage(localStorage) {
  const readLocal = async (key, fallback) => {
    try {
      const raw = await localStorage.get(key);
      if (raw === undefined || raw === null || raw === "") return fallback;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return fallback;
    }
  };

  const writeCloud = async (key, value) => {
    if (!supabase || !userId || LOCAL_ONLY_KEYS.has(key)) return;
    const { error } = await supabase
      .from("deutsch_meister_state")
      .upsert({
        user_id: userId,
        state_key: key,
        state_value: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,state_key" });

    if (error) {
      lastCloudError = error.message;
      throw error;
    }
    lastCloudError = "";
  };

  return {
    async get(key, fallback) {
      const local = await readLocal(key, fallback);
      if (!supabase || !userId || LOCAL_ONLY_KEYS.has(key)) return local;

      try {
        const { data, error } = await supabase
          .from("deutsch_meister_state")
          .select("state_value")
          .eq("user_id", userId)
          .eq("state_key", key)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          await localStorage.set(key, JSON.stringify(data.state_value));
          lastCloudError = "";
          return data.state_value ?? fallback;
        }

        if (local !== fallback) await writeCloud(key, local);
        return local;
      } catch (error) {
        lastCloudError = error.message;
        return local;
      }
    },

    async set(key, value) {
      await localStorage.set(key, JSON.stringify(value));
      try {
        await writeCloud(key, value);
      } catch {
        // Local SQLite remains the offline source until cloud sync succeeds again.
      }
    },

    async remove(key) {
      await localStorage.remove(key);
      if (!supabase || !userId || LOCAL_ONLY_KEYS.has(key)) return;

      try {
        const { error } = await supabase
          .from("deutsch_meister_state")
          .delete()
          .eq("user_id", userId)
          .eq("state_key", key);
        if (error) throw error;
        lastCloudError = "";
      } catch (error) {
        lastCloudError = error.message;
      }
    },
  };
}
