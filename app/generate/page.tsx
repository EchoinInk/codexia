"use client";

import { useState } from "react";

type GenerateArtifact = {
  kind?: string;
  path?: string;
  url?: string;
  preview_base64?: string;
};

type GenerateResponse = {
  request_id?: string;
  seed?: string | number;
  artifacts?: GenerateArtifact[];
  error?: string;
  details?: string;
};

export default function GeneratePage() {
  const [brief, setBrief] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [generatedImageSrc, setGeneratedImageSrc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setResult(null);
    setGeneratedImageSrc(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      const data: GenerateResponse = await res.json();
      const nextGeneratedImageSrc = data.artifacts?.[0]?.preview_base64
        ? `data:image/png;base64,${data.artifacts[0].preview_base64}`
        : null;

      setResult(data);
      setGeneratedImageSrc(nextGeneratedImageSrc);

      if (!res.ok) {
        setErrorMessage(data.error ?? "Generation failed.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not complete generation."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Lumo Engine
            </p>
            <h1 className="text-3xl font-semibold text-white">
              Generate Lumo Symbol
            </h1>
            <p className="text-sm leading-6 text-neutral-300">
              Describe the logo direction and preview the generated PNG directly
              on the page.
            </p>
          </div>

          <textarea
            className="min-h-48 w-full rounded-2xl border border-white/10 bg-neutral-900/80 p-4 text-sm text-neutral-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            placeholder="Describe the symbol you want…"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />

          <button
            onClick={generate}
            disabled={loading || !brief.trim()}
            className="inline-flex items-center justify-center rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/50"
          >
            {loading ? "Generating…" : "Generate"}
          </button>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
              <p className="font-medium">Generation failed</p>
              <p className="mt-1 text-red-100/80">{errorMessage}</p>
              {result?.details ? (
                <p className="mt-2 text-xs text-red-100/60">{result.details}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/[0.03] p-6 shadow-2xl shadow-black/30">
          {!result && !loading ? (
            <div className="flex min-h-[32rem] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 p-8 text-center">
              <div className="max-w-md space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                  Waiting For Prompt
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  Your generated concept will appear here.
                </h2>
                <p className="text-sm leading-6 text-neutral-400">
                  Submit a brief to render the first Lumo logo concept preview.
                </p>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[32rem] items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-8 text-center">
              <div className="space-y-4">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-indigo-400" />
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">
                    Generating concept
                  </h2>
                  <p className="text-sm text-neutral-400">
                    The engine is rendering a PNG preview now.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {result && !loading ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                    Generation Result
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Latest Lumo concept
                  </h2>
                </div>
                {result.request_id ? (
                  <p className="text-xs text-neutral-500">
                    Request ID: {result.request_id}
                  </p>
                ) : null}
              </div>

              <div className="flex min-h-[32rem] items-center justify-center rounded-3xl border border-white/10 bg-black/20 p-6">
                {generatedImageSrc ? (
                  <img
                    src={generatedImageSrc}
                    alt="Generated Lumo logo concept"
                    className="w-full h-auto rounded-2xl object-contain"
                  />
                ) : (
                  <div className="max-w-sm text-center">
                    <p className="text-lg font-medium text-white">
                      No preview image was returned.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">
                      The request completed, but the engine response did not
                      include `artifacts[0].preview_base64`.
                    </p>
                  </div>
                )}
              </div>

              {result.seed !== undefined && result.seed !== null ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">
                  Seed:{" "}
                  <span className="font-medium text-white">
                    {String(result.seed)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
