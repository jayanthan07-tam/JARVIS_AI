import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import { getSystemSpecs } from "@/lib/systemSpecs";
import { authorizeApiRequest, handleApiError, readJsonRequest } from "@/lib/apiSecurity";

const APPROVED_SITES: Record<string, string> = {
  google: "https://www.google.com",
  github: "https://github.com",
  wikipedia: "https://www.wikipedia.org",
  arxiv: "https://arxiv.org",
  youtube: "https://www.youtube.com",
};

export async function GET(request: NextRequest) {
  const blocked = await authorizeApiRequest(request);
  if (blocked) return blocked;

  try {
    const specs = await getSystemSpecs();

    const systemInfo = {
      platform: os.platform(),
      release: specs.osVersion,
      arch: specs.osArch,
      cpuModel: specs.cpuName,
      cpuCores: specs.cpuCores,
      cpuLogicalProcessors: specs.cpuLogicalProcessors,
      totalMemoryGb: specs.totalMemoryGb.toFixed(2),
      usedMemoryGb: specs.usedMemoryGb.toFixed(2),
      freeMemoryGb: specs.freeMemoryGb.toFixed(2),
      memoryUsagePercent: specs.memoryUsagePercent,
      uptimeSeconds: os.uptime(),
      nodeVersion: specs.nodeVersion,
      timestamp: specs.retrievedAt,
      approvedSites: Object.keys(APPROVED_SITES),
      // Rich verified specifications
      manufacturer: specs.manufacturer,
      model: specs.model,
      systemType: specs.systemType,
      primaryGpu: specs.primaryGpu,
      gpus: specs.gpus,
      osName: specs.osName,
      osBuild: specs.osBuild,
      osDisplayVersion: specs.osDisplayVersion,
      disks: specs.disks,
      battery: specs.battery,
    };

    return NextResponse.json({ system: systemInfo, specs });
  } catch (err: unknown) {
    return handleApiError("system-status", err);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await authorizeApiRequest(req, "write");
  if (blocked) return blocked;

  try {
    const body = await readJsonRequest(req, 8 * 1024);
    const action = body.action;
    const target = body.target;
    const query = body.query;

    if (action === "open_site") {
      if (typeof target !== "string" || !APPROVED_SITES[target.toLowerCase()]) {
        return NextResponse.json(
          {
            error: `Choose an approved site: ${Object.keys(APPROVED_SITES).join(", ")}.`,
          },
          { status: 403 }
        );
      }
      const url = APPROVED_SITES[target.toLowerCase()];
      return NextResponse.json({
        success: true,
        action: "open_site",
        url,
        message: `Approved directive: Navigating to ${target.toUpperCase()} (${url})`,
      });
    }

    if (action === "search_web") {
      const q = typeof query === "string" ? query.trim() : "";
      if (!q || q.length > 500) {
        return NextResponse.json({ error: "Search query is required." }, { status: 400 });
      }
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      return NextResponse.json({
        success: true,
        action: "search_web",
        url,
        message: `Opening web search directive for: "${q}"`,
      });
    }

    if (action === "run_diagnostic") {
      return NextResponse.json({
        success: true,
        action: "run_diagnostic",
        simulated: true,
        status: "SIMULATED",
        checks: [
          { system: "NEURAL CORE", status: "ONLINE", latency: "1.2ms" },
          { system: "ARC TELEMETRY", status: "NOMINAL", capacitance: "99.8%" },
          { system: "GESTURE SENSOR", status: "CALIBRATED", fps: "30" },
          { system: "LOCAL STORAGE", status: "SECURE", engine: "SQLite Native" },
        ],
        message: "Simulated diagnostic display only. These values are not measured from this machine, sir.",
      });
    }

    if (action === "system_lock") {
      return NextResponse.json({
        success: true,
        action: "system_lock",
        message: "Perimeter lockdown protocol simulated. Interface secured, sir.",
      });
    }

    return NextResponse.json({ error: "Unrecognized or unauthorized directive." }, { status: 400 });
  } catch (err: unknown) {
    return handleApiError("system-action", err);
  }
}
