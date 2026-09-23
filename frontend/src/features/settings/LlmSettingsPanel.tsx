import { useCallback, useEffect, useState } from "react";
import {
  getDirectorModel,
  setDirectorModel,
  type DirectorModelStatus,
} from "../director/api";

function runtimeLabel(runtime: string | undefined): string {
  if (runtime === "harness") return "Harness (Node sidecar loop)";
  if (runtime === "legacy") return "Legacy (Python loop)";
  return runtime || "unknown";
}

export function LlmSettingsPanel({ active = true }: { active?: boolean }) {
  const [status, setStatus] = useState<DirectorModelStatus | null>(null);
  const [draftModel, setDraftModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const st = await getDirectorModel();
      setStatus(st);
      setDraftModel(st.model || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  const dirty = status != null && draftModel !== (status.model || "");
  const canSave =
    Boolean(draftModel) &&
    dirty &&
    !saving &&
    status?.reachable !== false &&
    (status?.available?.length ?? 0) > 0;

  const onSave = async () => {
    if (!draftModel) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const st = await setDirectorModel(draftModel, true);
      setStatus(st);
      setDraftModel(st.model || draftModel);
      setMessage("Saved for chat, planning, compaction, and the Harness sidecar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const options = status?.available ?? [];
  const provider = status?.provider ?? "…";

  return (
    <section className="llm-settings-panel card" aria-labelledby="llm-settings-heading">
      <h2 id="llm-settings-heading">Director LLM</h2>
      <p className="muted">
        One model for the whole planning stack: Director chat, tool calls, context compaction,
        and the Harness sidecar (the sidecar does not run its own LLM). Provider and endpoint
        come from <code>backend/.env</code> (<code>DS_LLM_PROVIDER</code>,{" "}
        <code>DS_LLM_BASE_URL</code>).
      </p>

      {loading && !status ? <p>Loading LLM catalog…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {status ? (
        <>
          <dl className="llm-settings-meta">
            <div>
              <dt>Provider</dt>
              <dd>{provider}</dd>
            </div>
            <div>
              <dt>Endpoint</dt>
              <dd>
                <code>{status.endpoint_url || "—"}</code>
              </dd>
            </div>
            <div>
              <dt>Agent runtime</dt>
              <dd>{runtimeLabel(status.agent_runtime)}</dd>
            </div>
            <div>
              <dt>GPU unload before Comfy</dt>
              <dd>{status.uses_local_gpu ? "Yes (local provider)" : "No (remote API)"}</dd>
            </div>
            <div>
              <dt>Saved to</dt>
              <dd>
                <code>{status.persisted_to || "data/director_model.json"}</code>
              </dd>
            </div>
          </dl>

          <label className="llm-settings-picker">
            <span>Model from {provider === "llama-swap" ? "llama-swap" : provider}</span>
            <select
              value={options.length ? draftModel : ""}
              disabled={saving || !options.length || status.reachable === false}
              onChange={(event) => setDraftModel(event.target.value)}
            >
              {!options.length ? (
                <option value="">
                  {status.reachable === false
                    ? "Provider unreachable — check llama-swap and .env"
                    : "No models in catalog"}
                </option>
              ) : (
                <>
                  {!draftModel ? <option value="">Select a model</option> : null}
                  {draftModel && !options.includes(draftModel) ? (
                    <option value={draftModel}>{draftModel} (saved, not in catalog)</option>
                  ) : null}
                  {options.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>

          <div className="llm-settings-actions">
            <button type="button" className="btn primary" disabled={!canSave} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save model"}
            </button>
            <button type="button" className="btn secondary" disabled={loading || saving} onClick={() => void load()}>
              Refresh catalog
            </button>
          </div>
          {message ? <p className="success">{message}</p> : null}
          {status.source === "persisted" || status.source === "runtime" ? (
            <p className="muted">
              Current choice source: {status.source}
              {status.model ? ` (${status.model})` : ""}.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
