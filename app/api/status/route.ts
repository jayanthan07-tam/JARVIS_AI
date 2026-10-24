import { NextRequest, NextResponse } from "next/server";
import { checkProviderHealth } from "@/lib/aiProvider";
import { authorizeApiRequest } from "@/lib/apiSecurity";

export async function GET(request: NextRequest) {
  const blocked = await authorizeApiRequest(request, "status");
  if (blocked) return blocked;

  try {
    const health = await checkProviderHealth();

    // Preserve existing schema for frontend components & telemetry
    return NextResponse.json({
      connected: health.localConnected,
      model: health.localModel,
      modelAvailable: health.localModelAvailable,
      availableModels: health.availableLocalModels,
      cloudConfigured: health.cloudConfigured,
      cloudProvider: health.cloudProviderName,
      activeProvider: health.activeProvider,
      error: health.error ? "Local AI provider is unavailable." : null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        connected: false,
        model: "llama3.2:3b",
        modelAvailable: false,
        error: "Provider status is temporarily unavailable.",
        cloudConfigured: false,
        cloudProvider: "Not Configured",
        activeProvider: "offline",
      },
      { status: 503 }
    );
  }
}
