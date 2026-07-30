"use client";

export function SettingsPanel() {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-ink-400/10 p-8 h-full overflow-auto">
      <h2 className="text-xl font-bold text-ink-900">Settings</h2>
      <p className="text-sm text-ink-500 mt-1">
        Configuration is read from <code className="font-mono text-brand">.env.local</code> at server start.
      </p>

      <div className="mt-6 space-y-5 max-w-xl">
        <Field label="WORKSPACE_DIR" desc="Absolute path Codexia is allowed to read/write." example="/Users/you/code/my-project" />
        <Field label="OLLAMA_URL" desc="Ollama HTTP endpoint." example="http://localhost:11434" />
        <Field label="OLLAMA_MODEL" desc="Model tag (must be pulled via `ollama pull`)." example="qwen2.5-coder" />
      </div>

      <div className="mt-8 text-xs text-ink-500 border-t border-ink-400/10 pt-4">
        Restart the dev server after changing <code className="font-mono">.env.local</code>.
      </div>
    </div>
  );
}

function Field({ label, desc, example }: { label: string; desc: string; example: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider font-semibold text-ink-400">{label}</div>
      <div className="text-sm text-ink-700 mt-1">{desc}</div>
      <div className="mt-1.5 font-mono text-[13px] bg-[#f4f7fe] border border-ink-400/10 rounded-lg px-3 py-2 text-ink-900">
        {example}
      </div>
    </div>
  );
}
