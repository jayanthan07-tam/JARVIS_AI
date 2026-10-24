import { NextRequest, NextResponse } from "next/server";
import {
  getAuthConfiguration,
  isAuthenticated,
  rateLimitRequest,
} from "@/lib/apiSecurity";

export async function GET(request: NextRequest) {
  const limited = rateLimitRequest(request, "default");
  if (limited) return limited;

  const config = getAuthConfiguration();
  if (!config.configured && (process.env.NODE_ENV === "production" || config.hasPartialConfiguration)) {
    return NextResponse.json(
      { configured: false, authRequired: true, authenticated: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const authRequired = config.configured;
  return NextResponse.json(
    {
      configured: config.configured,
      authRequired,
      authenticated: authRequired ? isAuthenticated(request) : true,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
