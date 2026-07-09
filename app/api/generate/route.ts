import { NextResponse } from "next/server";

function fluxPromptTemplate(brief: string) {
  const trimmedBrief = brief.trim();
  const hasNegativeInstructions =
    /\bno\s+(text|letters?|watermark|mockup|3d|shadows?|busy detail)\b/i.test(
      trimmedBrief
    );

  return [
    trimmedBrief,
    "centered composition",
    "clean white background",
    "minimal vector-like logo icon",
    ...(
      hasNegativeInstructions
        ? []
        : ["no text, letters, watermark, mockup, 3D, shadows, or busy detail"]
    ),
  ].join(", ");
}

export const runtime = "nodejs";

export const maxDuration = 900;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brief =
      typeof body?.brief === "string" ? body.brief.trim() : "";

    if (!brief) {
      return NextResponse.json(
        {
          error: "Missing required field: brief",
        },
        { status: 400 }
      );
    }

    const prompt = fluxPromptTemplate(brief);

    const res = await fetch("http://127.0.0.1:5001/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        output: "png",
        width: 512,
        height: 512,
        guidance_scale: 5.5,
        num_inference_steps: 12,
      }),
      cache: "no-store",
    });

    const rawText = await res.text();

    console.log("ENGINE STATUS:", res.status);

const engineData = JSON.parse(rawText);

console.log("ENGINE RESULT:", {
  requestId: engineData.request_id,
  backend: engineData.backend,
  seed: engineData.seed,
  artifact: engineData.artifacts?.[0]?.path,
});

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "The engine returned an error.",
          engineStatus: res.status,
          details: rawText,
        },
        { status: 502 }
      );
    }

    return new NextResponse(rawText, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      },
    });
  } catch (error) {
    console.error("Generate route error:", error);

    return NextResponse.json(
      {
        error: "Could not complete image generation request.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
