import { NextRequest, NextResponse } from "next/server";
import {
  ApiInputError,
  getAuthConfiguration,
  handleApiError,
  rateLimitRequest,
  readJsonRequest,
  setSessionCookie,
  validateRequestOrigin,
  verifyAccessPassword,
} from "@/lib/apiSecurity";

export async function POST(request: NextRequest) {
  const originFailure = validateRequestOrigin(request);
  if (originFailure) return originFailure;
  const limited = rateLimitRequest(request, "login");
  if (limited) return limited;

  const config = getAuthConfiguration();
  if (!config.configured) {
    return NextResponse.json(
      { error: "Server authentication is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const body = await readJsonRequest(request, 4 * 1024);
    if (!verifyAccessPassword(body.password)) {
      return NextResponse.json(
        { error: "The access password is incorrect." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const response = NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    setSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof ApiInputError) return handleApiError("auth-login", error);
    return handleApiError("auth-login", error);
  }
}
