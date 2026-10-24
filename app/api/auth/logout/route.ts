import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  rateLimitRequest,
  validateRequestOrigin,
} from "@/lib/apiSecurity";

export async function POST(request: NextRequest) {
  const originFailure = validateRequestOrigin(request);
  if (originFailure) return originFailure;
  const limited = rateLimitRequest(request, "write");
  if (limited) return limited;

  const response = NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(response);
  return response;
}
