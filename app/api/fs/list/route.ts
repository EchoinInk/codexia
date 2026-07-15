import { NextResponse } from "next/server";
import { listTree } from "@/lib/fs-safe";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tree = await listTree("");
    return NextResponse.json({ tree });
  } catch (error: unknown) {
  return Response.json({
    error:
      error instanceof Error
        ? error.message
        : String(error),
  });
}
}
