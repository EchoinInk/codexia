import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { safeResolve } from "@/lib/fs-safe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { path: p } = await req.json();
    if (!p) return NextResponse.json({ error: "path required" }, { status: 400 });
    const abs = safeResolve(p);
    await fs.rm(abs, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
