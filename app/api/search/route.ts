import { NextRequest, NextResponse } from "next/server";
import { searchTavily } from "@/lib/tavilySearch";
import { searchWeb } from "@/lib/webSearch";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

export async function GET(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "search");
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const rawMaxResults = parseInt(searchParams.get("max") || "5", 10);
    const maxResults = Number.isInteger(rawMaxResults) ? Math.min(10, Math.max(1, rawMaxResults)) : 5;

    if (!query.trim() || query.trim().length > 500) {
      return NextResponse.json(
        { error: "Provide a search query of 1 to 500 characters.", success: false },
        { status: 400 }
      );
    }

    const res = await searchTavily(query, isNaN(maxResults) ? 5 : maxResults);
    if (res.results.length === 0) {
      // Graceful fallback to verified webSearch wrapper if Tavily has no results
      const fallback = await searchWeb(query, maxResults);
      return NextResponse.json({
        success: true,
        query,
        provider: fallback.provider,
        results: fallback.results,
        fallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      query,
      provider: res.provider,
      results: res.results,
    });
  } catch (err: unknown) {
    const response = handleApiError("search", err);
    return NextResponse.json({ error: (await response.json()).error, success: false }, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "search");
  if (blocked) return blocked;

  try {
    const body = await readJsonRequest(req, 8 * 1024);
    const rawQuery = body.query ?? body.q;
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    const suppliedMaxResults = body.maxResults;
    if (suppliedMaxResults !== undefined && (typeof suppliedMaxResults !== "number" || !Number.isInteger(suppliedMaxResults))) {
      return NextResponse.json({ error: "maxResults must be a whole number.", success: false }, { status: 400 });
    }
    const maxResults = typeof suppliedMaxResults === "number" ? Math.min(10, Math.max(1, suppliedMaxResults)) : 5;

    if (!query || query.length > 500) {
      return NextResponse.json(
        { error: "Provide a search query of 1 to 500 characters.", success: false },
        { status: 400 }
      );
    }

    const res = await searchTavily(query, maxResults);
    if (res.results.length === 0) {
      const fallback = await searchWeb(query, maxResults);
      return NextResponse.json({
        success: true,
        query,
        provider: fallback.provider,
        results: fallback.results,
        fallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      query,
      provider: res.provider,
      results: res.results,
    });
  } catch (err: unknown) {
    const response = handleApiError("search", err);
    return NextResponse.json({ error: (await response.json()).error, success: false }, { status: response.status });
  }
}
