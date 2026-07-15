import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { safeResolve } from "@/lib/fs-safe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const p = searchParams.get("path");
    if (!p) return NextResponse.json({ error: "path required" }, { status: 400 });
    const abs = safeResolve(p);
    const content = await fs.readFile(abs, "utf8");
    return NextResponse.json({ path: p, content });
  } catch (error: unknown) {
  return Response.json({
    error:
      error instanceof Error
        ? error.message
        : String(error),
  });
}
}
