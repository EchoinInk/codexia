import { NextResponse } from "next/server";
import { listTree } from "@/lib/fs-safe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tree = await listTree("");
    return NextResponse.json({ tree });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
