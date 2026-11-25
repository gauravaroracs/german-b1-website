import React, { useState } from "react";

// The two-column comparison follows the 21st.dev AI Prompt Diff review pattern.
export default function ExperimentalConflictReview({ keys, reviewer, storage, onClose, onResolved }) {
  const [key, setKey] = useState(keys[0] || "");
  const [review, setReview] = useState(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = async () => {
    setBusy(true); setError(""); setReview(null); setChoice("");
    try { setReview(await reviewer.preview(key)); }
    catch (cause) { setError(cause.message || "Could not load both versions."); }
    finally { setBusy(false); }
  };
  const resolve = async () => {
    if (!review || !choice) return;
    setBusy(true); setError("");
    let applied = false;
    try {
      await new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 0)));
      await storage.freezeWrites();
      storage.assertWritesFrozen();
      const result = await reviewer.resolve(review, choice);
      applied = true;
      storage.assertWritesFrozen();
      onResolved(result);
    } catch (cause) {
      storage.resumeWrites();
      setError(applied ? `The choice was applied locally, but an edit may not be saved. Copy unsaved work before reloading. ${cause.message || ""}` : cause.message || "Could not apply this choice.");
      setBusy(false);
    }
  };
  const content = (deleted, value) => deleted ? "Deleted" : JSON.stringify(value, null, 2);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
    <div className="max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="sync-conflict-title" className="text-xl font-semibold">Review sync conflict</h2><p className="mt-1 text-sm text-[#6B7280]">Compare both copies before choosing. A recovery copy is kept in this test browser.</p></div><button autoFocus onClick={onClose} disabled={busy} className="min-h-10 rounded-lg px-3 text-sm font-semibold">Close</button></div>
      <label className="mt-4 block text-sm font-semibold">Data to review <select value={key} disabled={busy} onChange={(event) => { setKey(event.target.value); setReview(null); setChoice(""); }} className="ml-2 rounded-lg border border-gray-300 bg-white px-3 py-2">{keys.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button onClick={preview} disabled={busy || !key} className="mt-3 min-h-10 rounded-xl border border-gray-300 px-4 text-sm font-semibold">{busy ? "Working…" : "Compare versions"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {review && <div className="mt-4 space-y-4"><div className="grid gap-3 md:grid-cols-2"><section><h3 className="font-semibold">This browser</h3><pre tabIndex={0} className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-100 p-3 text-xs">{content(review.local.deleted, review.local.value)}</pre></section><section><h3 className="font-semibold">Cloud · revision {review.remote.revision}</h3><pre tabIndex={0} className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-100 p-3 text-xs">{content(review.remote.deleted, review.remote.value)}</pre></section></div>
        <fieldset disabled={busy} className="space-y-2"><legend className="font-semibold">Which version should be kept?</legend><label className="flex min-h-10 items-center gap-2"><input type="radio" name="conflict-choice" value="local" checked={choice === "local"} onChange={() => setChoice("local")} /> Keep this browser’s version and retry sync</label><label className="flex min-h-10 items-center gap-2"><input type="radio" name="conflict-choice" value="cloud" checked={choice === "cloud"} onChange={() => setChoice("cloud")} /> Keep the cloud version on this browser</label></fieldset>
        <p className="text-xs text-[#6B7280]">The app reloads after applying your choice. If either copy changes, you will be asked to review again.</p><button onClick={resolve} disabled={busy || !choice} className="min-h-10 rounded-xl bg-[#176c5f] px-4 text-sm font-semibold text-white disabled:opacity-50">Apply selected version</button></div>}
    </div>
  </div>;
}
