import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";

const loadSql = () => initSqlJs({ locateFile: () => wasmUrl });

const SQLITE_DB_NAME = "deutsch-meister-sqlite";
const SQLITE_STORE_NAME = "database";

const openDatabaseStore = (databaseName = SQLITE_DB_NAME) => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(SQLITE_STORE_NAME);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readSavedDatabase = async (databaseName) => {
  const db = await openDatabaseStore(databaseName);
  return new Promise((resolve, reject) => {
    const request = db.transaction(SQLITE_STORE_NAME, "readonly").objectStore(SQLITE_STORE_NAME).get("main");
    request.onsuccess = () => resolve(request.result ? new Uint8Array(request.result) : null);
    request.onerror = () => reject(request.error);
  });
};

const saveDatabase = async (bytes, expected, databaseName) => {
  const db = await openDatabaseStore(databaseName);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SQLITE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SQLITE_STORE_NAME);
    const read = store.get("main");
    let conflict;
    read.onsuccess = () => {
      const current = read.result ? new Uint8Array(read.result) : null;
      const unchanged = current === null && expected === null || current && expected && current.length === expected.length && current.every((value, index) => value === expected[index]);
      if (!unchanged) {
        conflict = new Error("Learning data changed in another tab. Reload before saving again.");
        transaction.abort();
        return;
      }
      store.put(bytes, "main");
    };
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(conflict || transaction.error || read.error || new Error("Could not save learning data."));
    transaction.onerror = () => reject(conflict || transaction.error || read.error || new Error("Could not save learning data."));
  });
};

const readLegacyData = async () => {
  try {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("deutsch-meister-storage", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise((resolve, reject) => {
      const store = db.transaction("kv", "readonly").objectStore("kv");
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      let keysDone = false;
      let valuesDone = false;
      const finish = () => {
        if (!keysDone || !valuesDone) return;
        resolve((valuesRequest.result || []).map((value, index) => ({ key: keysRequest.result[index], value })));
      };
      keysRequest.onsuccess = () => { keysDone = true; finish(); };
      valuesRequest.onsuccess = () => { valuesDone = true; finish(); };
      keysRequest.onerror = () => reject(keysRequest.error);
      valuesRequest.onerror = () => reject(valuesRequest.error);
    });
  } catch {
    return [];
  }
};

const prepareDatabase = (db, frequencyWords) => {
  db.run("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.run("CREATE TABLE IF NOT EXISTS frequency_words (word_index INTEGER PRIMARY KEY, word TEXT NOT NULL, part TEXT, translation TEXT NOT NULL, example TEXT, example_translation TEXT)");
  const count = db.exec("SELECT COUNT(*) AS count FROM frequency_words")[0]?.values[0]?.[0] || 0;
  if (!count && frequencyWords?.length) {
    const insert = db.prepare("INSERT INTO frequency_words VALUES (?,?,?,?,?,?)");
    frequencyWords.forEach((item, index) => insert.run([index, item.w, item.p || "", item.t || "", item.s || "", item.e || ""]));
    insert.free();
  }
};

export function createSqliteStorage(frequencyWords = [], { databaseName = SQLITE_DB_NAME, migrateLegacy = true } = {}) {
  let databasePromise;
  let lastSavedBytes = null;
  let operation = Promise.resolve();

  const getDatabase = () => {
    if (!databasePromise) {
      databasePromise = Promise.all([
        loadSql(),
        readSavedDatabase(databaseName),
      ]).then(async ([SQL, saved]) => {
        lastSavedBytes = saved;
        const db = new SQL.Database(saved || undefined);
        prepareDatabase(db, frequencyWords);
        if (!saved) {
          const legacy = migrateLegacy ? await readLegacyData() : [];
          const insert = db.prepare("INSERT OR IGNORE INTO kv VALUES (?,?)");
          legacy.forEach((item) => insert.run([item.key, typeof item.value === "string" ? item.value : JSON.stringify(item.value)]));
          insert.free();
          const bytes = db.export();
          await saveDatabase(bytes, lastSavedBytes, databaseName);
          lastSavedBytes = bytes;
        }
        return db;
      }).catch((error) => {
        databasePromise = undefined;
        throw error;
      });
    }
    return databasePromise;
  };

  const run = (callback, write = true) => {
    operation = operation.catch(() => undefined).then(async () => {
      const db = await getDatabase();
      try {
        const result = await callback(db);
        if (write) {
          const bytes = db.export();
          await saveDatabase(bytes, lastSavedBytes, databaseName);
          lastSavedBytes = bytes;
        }
        return result;
      } catch (error) {
        if (write) { db.close(); databasePromise = undefined; }
        throw error;
      }
    });
    return operation;
  };

  return {
    get: (key) => run((db) => {
      const rows = db.exec("SELECT value FROM kv WHERE key = $key", { "$key": key });
      return rows[0]?.values[0]?.[0];
    }, false),
    set: (key, value) => run((db) => {
      const statement = db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)");
      statement.run([key, value]);
      statement.free();
    }),
    remove: (key) => run((db) => db.run("DELETE FROM kv WHERE key = $key", { "$key": key })),
    compareAndSetBatch: ({ checks, writes }) => {
      if (!Array.isArray(checks) || !Array.isArray(writes) || !writes.length) throw new Error("A batch must contain checks and writes.");
      const expected = new Map();
      for (const check of checks) {
        if (!check || typeof check.key !== "string" || !check.key || expected.has(check.key) || (check.expected !== undefined && typeof check.expected !== "string")) throw new Error("Invalid batch check.");
        expected.set(check.key, check.expected);
      }
      const updates = new Map();
      for (const write of writes) {
        if (!write || typeof write.key !== "string" || !write.key || updates.has(write.key) || !expected.has(write.key) || (write.value !== undefined && typeof write.value !== "string")) throw new Error("Invalid batch write.");
        updates.set(write.key, write.value);
      }
      return run((db) => {
        for (const [key, value] of expected) {
          const rows = db.exec("SELECT value FROM kv WHERE key = $key", { "$key": key });
          if (rows[0]?.values[0]?.[0] !== value) throw new Error("Learning data changed since the preview. Review it again.");
        }
        const statement = db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)");
        try {
          for (const [key, value] of updates) {
            if (value === undefined) db.run("DELETE FROM kv WHERE key = $key", { "$key": key });
            else statement.run([key, value]);
          }
        } finally { statement.free(); }
      });
    },
  };
}

export async function exportToSqlite(data) {
  const SQL = await loadSql();
  const db = new SQL.Database();

  db.run("CREATE TABLE IF NOT EXISTS vocab (id TEXT PRIMARY KEY, word TEXT, artikel TEXT, plural TEXT, wordType TEXT, translation TEXT, tags TEXT, contexts TEXT, collocations TEXT, wordFamily TEXT, sourceContext TEXT, addedAt TEXT, srsInterval REAL, srsDue TEXT, srsEase REAL, srsReps INTEGER, srsLapses INTEGER, memoryTip TEXT, sourceTranslation TEXT, exampleStatus TEXT, srsLastReviewed TEXT, srsLastRating TEXT, forms TEXT, details TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, title TEXT, category TEXT, status TEXT, cover TEXT, words TEXT, text TEXT, questions TEXT, nextPrompt TEXT, modelContinuation TEXT, details TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS story_progress (storyId TEXT PRIMARY KEY, status TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, content TEXT, created_at TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS grammar_progress (key TEXT PRIMARY KEY, value TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS streak_data (dayKey TEXT PRIMARY KEY)");
  db.run("CREATE TABLE IF NOT EXISTS daily_blocks (dayKey TEXT PRIMARY KEY, blocks TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS speaking_log (dayKey TEXT PRIMARY KEY, rating INTEGER, note TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS anki_log (dayKey TEXT PRIMARY KEY, count INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS think_state (dayKey TEXT PRIMARY KEY, state TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS freq_known (wordIndex INTEGER PRIMARY KEY)");

  const insertVocab = db.prepare("INSERT OR REPLACE INTO vocab VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  (data.vocabWords || []).forEach((w) => {
    insertVocab.run([
      w.id, w.word, w.artikel, w.plural, w.wordType, w.translation,
      JSON.stringify(w.tags || []), JSON.stringify(w.contexts || []),
      JSON.stringify(w.collocations || []), JSON.stringify(w.wordFamily || []),
      w.sourceContext, w.addedAt, w.srsInterval || 1, w.srsDue,
      w.srsEase || 2.5, w.srsReps || 0, w.srsLapses || 0,
      w.memoryTip || "", w.sourceTranslation || "", w.exampleStatus || "unreviewed",
      w.srsLastReviewed || "", w.srsLastRating || "", JSON.stringify(w.forms || null),
      JSON.stringify(w),
    ]);
  });
  insertVocab.free();

  const insertStory = db.prepare("INSERT OR REPLACE INTO stories VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  (data.storedStories || []).forEach((s) => {
    const { id, title, category, status, cover, words, text, questions, nextPrompt, modelContinuation, ...details } = s;
    insertStory.run([id, title, category, status || "unread", cover || "",
      JSON.stringify(words || []), text, JSON.stringify(questions || []),
      nextPrompt, modelContinuation, JSON.stringify(details),
    ]);
  });
  insertStory.free();

  const insertMeta = db.prepare("INSERT OR REPLACE INTO meta VALUES (?,?)");
  insertMeta.run(["grammarProgress", JSON.stringify(data.grammarProgress || {})]);
  insertMeta.run(["grammarSession", JSON.stringify(data.grammarSession || {})]);
  insertMeta.run(["timerState", JSON.stringify(data.timerState || {})]);
  insertMeta.run(["storySession", JSON.stringify(data.storySession || {})]);
  insertMeta.run(["missionProgress", JSON.stringify(data.missionProgress || {})]);
  insertMeta.run(["dangerList", JSON.stringify(data.dangerList || [])]);
  insertMeta.run(["vocabReviewPreferences", JSON.stringify(data.vocabReviewPreferences || {})]);
  insertMeta.run(["freqReviewProgress", JSON.stringify(data.freqReviewProgress || {})]);
  insertMeta.run(["frequencyAdventureProgress", JSON.stringify(data.frequencyAdventureProgress || {})]);
  insertMeta.run(["frequencyAdventureSession", JSON.stringify(data.frequencyAdventureSession ?? null)]);
  insertMeta.run(["savedSentences", JSON.stringify(data.savedSentences || [])]);
  insertMeta.run(["sentenceExplanations", JSON.stringify(data.sentenceExplanations || [])]);
  insertMeta.run(["keptExamples", JSON.stringify(data.keptExamples || [])]);
  insertMeta.run(["grammarLessons", JSON.stringify(data.grammarLessons || [])]);
  insertMeta.run(["practiceMessages", JSON.stringify(data.practiceMessages || [])]);
  insertMeta.run(["practiceScenario", JSON.stringify(data.practiceScenario || null)]);
  insertMeta.run(["practiceDraft", JSON.stringify(data.practiceDraft || "")]);
  insertMeta.run(["exportedAt", new Date().toISOString()]);
  insertMeta.free();

  const insertStoryProgress = db.prepare("INSERT OR REPLACE INTO story_progress VALUES (?,?)");
  Object.entries(data.storyProgress || {}).forEach(([storyId, status]) => insertStoryProgress.run([storyId, status]));
  insertStoryProgress.free();

  const insertStreak = db.prepare("INSERT OR REPLACE INTO streak_data VALUES (?)");
  Object.keys(data.streakData || {}).filter((k) => data.streakData[k]).forEach((k) => insertStreak.run([k]));
  insertStreak.free();

  const insertBlock = db.prepare("INSERT OR REPLACE INTO daily_blocks VALUES (?,?)");
  Object.entries(data.blockData || {}).forEach(([k, v]) => insertBlock.run([k, JSON.stringify(v)]));
  insertBlock.free();

  const insertSpeaking = db.prepare("INSERT OR REPLACE INTO speaking_log VALUES (?,?,?)");
  Object.entries(data.speakingLog || {}).forEach(([k, v]) => insertSpeaking.run([k, v.rating, v.note]));
  insertSpeaking.free();

  const insertAnki = db.prepare("INSERT OR REPLACE INTO anki_log VALUES (?,?)");
  Object.entries(data.ankiLog || {}).forEach(([k, v]) => insertAnki.run([k, v]));
  insertAnki.free();

  const insertThink = db.prepare("INSERT OR REPLACE INTO think_state VALUES (?,?)");
  Object.entries(data.thinkState || {}).forEach(([k, v]) => insertThink.run([k, JSON.stringify(v)]));
  insertThink.free();

  const insertChat = db.prepare("INSERT OR REPLACE INTO chat_history VALUES (NULL,?,?,?)");
  (data.chatHistory || []).forEach((m, i) => insertChat.run([m.role, m.content, m.createdAt || new Date(Date.now() + i * 1000).toISOString()]));
  insertChat.free();

  const insertFreq = db.prepare("INSERT OR REPLACE INTO freq_known VALUES (?)");
  Object.keys(data.freqKnown || {}).filter((k) => data.freqKnown[k]).forEach((k) => insertFreq.run([Number(k)]));
  insertFreq.free();

  const buffer = db.export();
  db.close();
  return buffer;
}

function assertBackupJsonIsReadable(db) {
  const tableRows = db.exec("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tables = new Set((tableRows[0]?.values || []).map(([name]) => name));
  if (!tables.has("vocab") || !tables.has("meta")) throw new Error("This SQLite file is not a recognized Deutsch Meister backup (missing vocab or metadata). No data was imported.");
  const marker = db.exec("SELECT value FROM meta WHERE key = 'exportedAt'")[0]?.values?.[0]?.[0];
  if (typeof marker !== "string" || !Number.isFinite(Date.parse(marker))) throw new Error("This SQLite file has no recognizable backup timestamp. No data was imported.");
  const fields = {
    vocab: ["tags", "contexts", "collocations", "wordFamily", "forms", "details"],
    stories: ["words", "questions", "details"],
    daily_blocks: ["blocks"],
    think_state: ["state"],
  };
  const checkJson = (value, location, expected) => {
    if (value === null) {
      if (expected === "array" || expected === "object") throw new Error(`Invalid data in SQLite backup: ${location} is empty.`);
      return;
    }
    let parsed;
    try { parsed = JSON.parse(value); } catch { throw new Error(`Invalid JSON in SQLite backup: ${location}.`); }
    if (expected === "array" && !Array.isArray(parsed)) throw new Error(`Invalid data in SQLite backup: ${location} must be a list.`);
    if (expected === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) throw new Error(`Invalid data in SQLite backup: ${location} must be an object.`);
    if (expected === "optional-object" && parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) throw new Error(`Invalid data in SQLite backup: ${location} must be an object or null.`);
  };
  for (const [table, candidates] of Object.entries(fields)) {
    if (!tables.has(table)) continue;
    const columns = new Set((db.exec(`PRAGMA table_info(${table})`)[0]?.values || []).map((row) => row[1]));
    for (const column of candidates.filter((name) => columns.has(name))) {
      const rows = db.exec(`SELECT ${column} FROM ${table}`);
      const expected = ["forms", "details"].includes(column) ? "optional-object" : ["blocks", "state"].includes(column) ? "object" : "array";
      for (const [value] of rows[0]?.values || []) checkJson(value, `${table}.${column}`, expected);
    }
  }
  if (tables.has("meta")) {
    const known = new Set(["grammarProgress", "grammarSession", "timerState", "storySession", "missionProgress", "dangerList", "vocabReviewPreferences", "freqReviewProgress", "frequencyAdventureProgress", "frequencyAdventureSession", "savedSentences", "sentenceExplanations", "keptExamples", "grammarLessons", "practiceMessages", "practiceScenario", "practiceDraft"]);
    const rows = db.exec("SELECT key, value FROM meta");
    for (const [key, value] of rows[0]?.values || []) if (known.has(key)) checkJson(value, `meta.${key}`);
  }
}

export async function importFromSqlite(buffer) {
  const SQL = await loadSql();
  const db = new SQL.Database(new Uint8Array(buffer));

  try { assertBackupJsonIsReadable(db); } catch (error) { db.close(); throw error; }

  const data = {};

  try {
    const vocabRows = db.exec("SELECT * FROM vocab");
    data.vocabWords = [];
    if (vocabRows.length && vocabRows[0].values.length) {
      const cols = vocabRows[0].columns;
      data.vocabWords = vocabRows[0].values.map((row) => {
        const obj = {};
        cols.forEach((col, i) => {
          if (["tags", "contexts", "collocations", "wordFamily", "forms", "details"].includes(col) && row[i]) {
            try { obj[col] = JSON.parse(row[i]); } catch { obj[col] = []; }
          } else {
            obj[col] = row[i];
          }
        });
        if (obj.details && typeof obj.details === "object") Object.assign(obj, obj.details);
        delete obj.details;
        return obj;
      });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT * FROM meta");
    if (rows.length) {
      rows[0].values.forEach(([key, value]) => {
        try { data[key] = JSON.parse(value); } catch { data[key] = value; }
      });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT dayKey FROM streak_data");
    data.streakData = {};
    if (rows.length) {
      data.streakData = {};
      rows[0].values.forEach(([k]) => { data.streakData[k] = true; });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT dayKey, blocks FROM daily_blocks");
    data.blockData = {};
    if (rows.length) {
      data.blockData = {};
      rows[0].values.forEach(([k, v]) => {
        try { data.blockData[k] = JSON.parse(v); } catch {}
      });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT dayKey, rating, note FROM speaking_log");
    data.speakingLog = {};
    if (rows.length) {
      data.speakingLog = {};
      rows[0].values.forEach(([k, r, n]) => { data.speakingLog[k] = { rating: r, note: n || "" }; });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT dayKey, count FROM anki_log");
    data.ankiLog = {};
    if (rows.length) {
      data.ankiLog = {};
      rows[0].values.forEach(([k, c]) => { data.ankiLog[k] = c; });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT role, content FROM chat_history ORDER BY id");
    data.chatHistory = [];
    if (rows.length) {
      data.chatHistory = rows[0].values.map(([role, content]) => ({ role, content }));
    }
  } catch {}

  try {
    const rows = db.exec("SELECT * FROM stories");
    data.storedStories = [];
    if (rows.length) {
      const cols = rows[0].columns;
      data.storedStories = rows[0].values.map((row) => {
        const obj = {};
        cols.forEach((col, i) => {
          if (["words", "questions", "details"].includes(col) && row[i]) {
            try { obj[col] = JSON.parse(row[i]); } catch { obj[col] = []; }
          } else {
            obj[col] = row[i];
          }
        });
        if (obj.details && typeof obj.details === "object") Object.assign(obj, obj.details);
        delete obj.details;
        return obj;
      });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT storyId, status FROM story_progress");
    data.storyProgress = {};
    if (rows.length) {
      data.storyProgress = {};
      rows[0].values.forEach(([id, s]) => { data.storyProgress[id] = s; });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT wordIndex FROM freq_known");
    data.freqKnown = {};
    if (rows.length) {
      data.freqKnown = {};
      rows[0].values.forEach(([i]) => { data.freqKnown[i] = true; });
    }
  } catch {}

  try {
    const rows = db.exec("SELECT dayKey, state FROM think_state");
    data.thinkState = {};
    if (rows.length) {
      data.thinkState = {};
      rows[0].values.forEach(([k, v]) => {
        try { data.thinkState[k] = JSON.parse(v); } catch { data.thinkState[k] = v; }
      });
    }
  } catch {}

  db.close();
  return data;
}
