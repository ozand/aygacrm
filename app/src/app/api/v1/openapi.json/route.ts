import { NextResponse } from "next/server";
import spec from "@/../docs/api/openapi.json";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(spec);
}
