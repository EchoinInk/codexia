import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { safeResolve } from "@/lib/fs-safe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { path: p, content } = await req.json();
    if (!p || typeof content !== "string") {
      return NextResponse.json({ error: "path and content required" }, { status: 400 });
    }
    const abs = safeResolve(p);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    return NextResponse.json({ ok: true, path: p });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
