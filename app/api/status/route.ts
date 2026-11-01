import { NextResponse } from "next/server";
import { snapshot } from "@/lib/meter";
import { hasKey } from "@/lib/stepfun";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ live: hasKey(), meter: snapshot() });
}
