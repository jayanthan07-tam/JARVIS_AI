import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_TIMEZONE, getTemporalContext } from "./dateTime.ts";

const execFileAsync = promisify(execFile);

export interface DiskInfo {
  drive: string;
  label: string;
  totalGb: number;
  freeGb: number;
  usedGb: number;
  percentUsed: number;
  percentFree: number;
}

export interface GpuInfo {
  name: string;
  vramMb: number;
  driverVersion: string;
  videoProcessor: string;
}

export interface BatteryInfo {
  isPresent: boolean;
  percent: number | null;
  isCharging: boolean;
  isDischarging: boolean;
  isPowerOnline: boolean;
  statusText: string;
}

export interface SystemSpecs {
  // Laptop Identification
  manufacturer: string;
  model: string;
  systemType: string;

  // CPU
  cpuName: string;
  cpuCores: number;
  cpuLogicalProcessors: number;
  cpuBaseSpeedMhz: number;

  // RAM
  totalMemoryGb: number;
  usedMemoryGb: number;
  freeMemoryGb: number;
  memoryUsagePercent: number;

  // GPU
  gpus: GpuInfo[];
  primaryGpu: string;

  // Operating System
  osName: string;
  osVersion: string;
  osBuild: string;
  osDisplayVersion: string;
  osArch: string;

  // Storage Drives
  disks: DiskInfo[];

  // Battery / Power
  battery: BatteryInfo;

  // Data provenance: false when the PowerShell hardware query failed.
  // Fields marked "Unavailable" were NOT read from the machine.
  queryOk: boolean;

  // System State & Time
  uptimeHours: number;
  uptimeMinutes: number;
  nodeVersion: string;
  currentTime: string;
  currentDate: string;
  timezone: string;
  retrievedAt: string;
}

export type SystemQueryType =
  | "ALL_SPECS"
  | "CPU_RAM"
  | "CPU"
  | "RAM"
  | "GPU"
  | "STORAGE"
  | "OS"
  | "BATTERY"
  | "MODEL";

export interface SystemQueryDetection {
  isSystemQuery: boolean;
  category: SystemQueryType;
  title: string;
}

// In-memory cache for fast, non-blocking telemetry responses
let cachedSpecs: SystemSpecs | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25 seconds cache for dynamic refresh

/**
 * Normalizes input text for keyword and regex matching
 */
function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects if a user message is inquiring about laptop hardware or system specifications.
 */
export function detectSystemSpecsQuery(rawQuery: string): SystemQueryDetection {
  const q = normalizeQuery(rawQuery);

  if (!q) {
    return { isSystemQuery: false, category: "ALL_SPECS", title: "" };
  }

  // 1. Battery inquiries
  if (
    /battery\s+(percentage|percent|level|status|health|life|remaining)/.test(q) ||
    /how\s+much\s+battery/.test(q) ||
    /is\s+(my\s+)?(laptop|computer|system)\s+(charging|plugged\s+in)/.test(q) ||
    q === "battery" ||
    q === "battery percentage"
  ) {
    return { isSystemQuery: true, category: "BATTERY", title: "Battery Status" };
  }

  // 2. Storage & Disk space inquiries
  if (
    /(storage|disk|hard\s*drive|free\s*space|drive\s*space)/.test(q) &&
    /(available|free|capacity|left|size|total|c\s+and\s+d|drives?)/.test(q) ||
    /how\s+much\s+(storage|disk|space)\s+(is\s+)?(available|left|free|on)/.test(q) ||
    /(storage|space)\s+on\s+([c-z]\s*(and\s*[c-z])?\s*drives?)/.test(q)
  ) {
    return { isSystemQuery: true, category: "STORAGE", title: "Storage Drives Capacity" };
  }

  // 3. GPU / Graphics inquiries
  if (
    /(gpu|graphics\s*card|video\s*card|display\s*adapter|graphics\s*processor)/.test(q) ||
    /which\s+gpu/.test(q) ||
    /what\s+(is\s+my\s+)?gpu/.test(q)
  ) {
    return { isSystemQuery: true, category: "GPU", title: "Graphics Processor (GPU)" };
  }

  // 4. Combined CPU and RAM inquiries
  if (
    (/(cpu|processor)/.test(q) && /(ram|memory)/.test(q)) ||
    /cpu\s+and\s+ram/.test(q) ||
    /ram\s+and\s+cpu/.test(q)
  ) {
    return { isSystemQuery: true, category: "CPU_RAM", title: "CPU & Memory Specifications" };
  }

  // 5. Individual CPU inquiries
  if (
    /what\s+(is\s+my\s+)?(cpu|processor)/.test(q) ||
    /which\s+(cpu|processor)/.test(q) ||
    /processor\s+(name|model|speed|cores|specs)/.test(q) ||
    /cpu\s+(name|model|speed|cores|specs)/.test(q)
  ) {
    return { isSystemQuery: true, category: "CPU", title: "Processor (CPU)" };
  }

  // 6. Individual RAM inquiries
  if (
    /how\s+much\s+(ram|memory)\s+(do\s+i\s+have|is\s+installed|installed)/.test(q) ||
    /what\s+(is\s+my\s+)?(ram|memory|installed\s+ram)/.test(q) ||
    /total\s+(ram|memory)/.test(q)
  ) {
    return { isSystemQuery: true, category: "RAM", title: "Installed Memory (RAM)" };
  }

  // 7. Operating system inquiries
  if (
    /what\s+(windows\s+version|os\s+version|operating\s+system)/.test(q) ||
    /which\s+(windows\s+version|windows\s+edition|operating\s+system)/.test(q) ||
    /windows\s+(version|edition|build)/.test(q) ||
    /os\s+(version|build|architecture)/.test(q)
  ) {
    return { isSystemQuery: true, category: "OS", title: "Operating System Details" };
  }

  // 8. Laptop Model / Manufacturer inquiries
  if (
    /what\s+(is\s+my\s+)?(laptop|computer|pc|machine|device)\s*(model|make|manufacturer|name)/.test(q) ||
    /what\s+laptop\s+(am\s+i\s+using|do\s+i\s+have)/.test(q) ||
    /who\s+made\s+my\s+laptop/.test(q) ||
    /laptop\s+model/.test(q)
  ) {
    return { isSystemQuery: true, category: "MODEL", title: "Laptop Model & Manufacturer" };
  }

  // 9. All specifications / General System info inquiries
  if (
    /(laptop|system|computer|hardware|machine|pc)\s+(specifications|specs|info|details|configuration)/.test(q) ||
    /what\s+are\s+my\s+(laptop|computer|pc|system)\s*(specs|specifications)/.test(q) ||
    /tell\s+me\s+my\s+(laptop|computer|pc|system)\s*(specs|specifications)/.test(q) ||
    /system\s+specifications/.test(q) ||
    /hardware\s+specs/.test(q) ||
    /laptop\s+specs/.test(q)
  ) {
    return { isSystemQuery: true, category: "ALL_SPECS", title: "Laptop Hardware Specifications" };
  }

  return { isSystemQuery: false, category: "ALL_SPECS", title: "" };
}

/**
 * Retrieves actual hardware and operating system specifications from the local Windows host.
 */
export async function getSystemSpecs(options?: { forceRefresh?: boolean }): Promise<SystemSpecs> {
  const now = Date.now();
  if (!options?.forceRefresh && cachedSpecs && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedSpecs;
  }

  const temporal = getTemporalContext(new Date(), DEFAULT_TIMEZONE);
  const scriptPath = path.resolve(process.cwd(), "lib", "query_system_specs.ps1");

  let parsedRaw: any = null;

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { timeout: 7000 }
    );
    if (stdout && stdout.trim()) {
      parsedRaw = JSON.parse(stdout.trim());
    }
  } catch (err) {
    console.warn("PowerShell system query notice:", err instanceof Error ? err.message : String(err));
  }

  // Extract Computer System
  const cs = parsedRaw?.ComputerSystem;
  const queryOk = Boolean(parsedRaw);
  const manufacturer = cs?.Manufacturer?.trim() || "Unavailable";
  const model = cs?.Model?.trim() || "Unavailable";
  const systemType = cs?.SystemType?.trim() || "Unavailable";

  // Extract CPU
  const cpu = parsedRaw?.CPU;
  const nodeCpus = os.cpus();
  // Node reports real logical CPUs and the CPU model string even without PowerShell.
  const cpuName = cpu?.Name?.trim() || nodeCpus[0]?.model?.trim() || "Unavailable";
  const cpuCores = Number(cpu?.NumberOfCores) || 0;
  const cpuLogicalProcessors = Number(cpu?.NumberOfLogicalProcessors) || nodeCoresLogical(nodeCpus);
  const cpuBaseSpeedMhz = Number(cpu?.MaxClockSpeed) || nodeCpus[0]?.speed || 0;

  // Extract RAM
  const totalPhysicalBytes = Number(cs?.TotalPhysicalMemory) || os.totalmem();
  const totalVisibleKb = Number(parsedRaw?.OS?.TotalVisibleMemorySize) || 0;
  const freePhysicalKb = Number(parsedRaw?.OS?.FreePhysicalMemory) || 0;

  const totalMemGb = totalVisibleKb > 0
    ? totalVisibleKb / (1024 * 1024)
    : totalPhysicalBytes / (1024 ** 3);

  const freeMemGb = freePhysicalKb > 0
    ? freePhysicalKb / (1024 * 1024)
    : os.freemem() / (1024 ** 3);

  const usedMemGb = Math.max(0, totalMemGb - freeMemGb);
  const memUsagePercent = Math.min(100, Math.max(0, Math.round((usedMemGb / (totalMemGb || 1)) * 100)));

  // Extract GPUs
  const rawGpus: any[] = Array.isArray(parsedRaw?.GPUs)
    ? parsedRaw.GPUs
    : parsedRaw?.GPUs ? [parsedRaw.GPUs] : [];

  const gpus: GpuInfo[] = rawGpus.map((g: any) => ({
    name: g?.Name?.trim() || "Graphics Adapter",
    vramMb: Math.round((Number(g?.AdapterRAM) || 0) / (1024 * 1024)),
    driverVersion: g?.DriverVersion?.trim() || "Unavailable",
    videoProcessor: g?.VideoProcessor?.trim() || "",
  }));

  const primaryGpu = gpus[0]?.name || "Unavailable";

  // Extract OS
  const osData = parsedRaw?.OS;
  const osName = osData?.Caption?.trim() || `Microsoft Windows (${os.platform()})`;
  const osVersion = osData?.Version?.trim() || os.release();
  const osBuild = osData?.BuildNumber?.trim() || "Unavailable";
  const osDisplayVersion = osData?.DisplayVersion?.trim() || "Unavailable";
  const osArch = osData?.OSArchitecture?.trim() || (os.arch() === "x64" ? "64-bit" : os.arch());

  // Extract Disks
  const rawDisks: any[] = Array.isArray(parsedRaw?.Disks)
    ? parsedRaw.Disks
    : parsedRaw?.Disks ? [parsedRaw.Disks] : [];

  const disks: DiskInfo[] = rawDisks.map((d: any) => {
    const sizeBytes = Number(d?.Size) || 0;
    const freeBytes = Number(d?.FreeSpace) || 0;
    const totalGb = sizeBytes / (1024 ** 3);
    const freeGb = freeBytes / (1024 ** 3);
    const usedGb = Math.max(0, totalGb - freeGb);
    const percentUsed = totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0;
    const percentFree = totalGb > 0 ? Math.round((freeGb / totalGb) * 100) : 0;

    return {
      drive: d?.DeviceID || "C:",
      label: d?.VolumeName || "Local Disk",
      totalGb: Math.round(totalGb * 10) / 10,
      freeGb: Math.round(freeGb * 10) / 10,
      usedGb: Math.round(usedGb * 10) / 10,
      percentUsed,
      percentFree,
    };
  });

  // Extract Battery
  const rawBat = parsedRaw?.Battery;
  let battery: BatteryInfo;
  if (rawBat && typeof rawBat.EstimatedChargeRemaining === "number") {
    const pct = rawBat.EstimatedChargeRemaining;
    const isCharging = Boolean(rawBat.Charging);
    const isDischarging = Boolean(rawBat.Discharging);
    const isPowerOnline = Boolean(rawBat.PowerOnline);

    let statusText = `${pct}%`;
    if (isCharging) {
      statusText += " · AC Connected (Charging)";
    } else if (isPowerOnline) {
      statusText += " · AC Connected (Fully Charged / Maintaining)";
    } else if (isDischarging) {
      statusText += " · Discharging (On Battery)";
    } else {
      statusText += " · Normal State";
    }

    battery = {
      isPresent: true,
      percent: pct,
      isCharging,
      isDischarging,
      isPowerOnline,
      statusText,
    };
  } else {
    battery = {
      isPresent: false,
      percent: null,
      isCharging: false,
      isDischarging: false,
      isPowerOnline: true,
      statusText: "AC Power Connected (No Battery Sensor / Desktop)",
    };
  }

  const uptimeSec = os.uptime();
  const uptimeHours = Math.floor(uptimeSec / 3600);
  const uptimeMinutes = Math.floor((uptimeSec % 3600) / 60);

  const specs: SystemSpecs = {
    manufacturer,
    model,
    systemType,
    queryOk,
    cpuName,
    cpuCores,
    cpuLogicalProcessors,
    cpuBaseSpeedMhz,
    totalMemoryGb: Math.round(totalMemGb * 100) / 100,
    usedMemoryGb: Math.round(usedMemGb * 100) / 100,
    freeMemoryGb: Math.round(freeMemGb * 100) / 100,
    memoryUsagePercent: memUsagePercent,
    gpus,
    primaryGpu,
    osName,
    osVersion,
    osBuild,
    osDisplayVersion,
    osArch,
    disks,
    battery,
    uptimeHours,
    uptimeMinutes,
    nodeVersion: process.version,
    currentTime: temporal.today.time12 || new Date().toLocaleTimeString("en-US", { timeZone: DEFAULT_TIMEZONE }),
    currentDate: temporal.today.full,
    timezone: DEFAULT_TIMEZONE,
    retrievedAt: new Date().toISOString(),
  };

  cachedSpecs = specs;
  lastCacheTime = now;
  return specs;
}

function nodeCoresLogical(cpus: os.CpuInfo[]): number {
  return cpus.length;
}

/**
 * Builds deterministic, factual response text in J.A.R.V.I.S.'s tone.
 */
export function formatSystemSpecsResponse(category: SystemQueryType, specs: SystemSpecs): string {
  const intro = "Allow me to review your workstation telemetry, sir.";

  switch (category) {
    case "MODEL": {
      const displayModel = specs.model.toLowerCase().startsWith(specs.manufacturer.toLowerCase())
        ? specs.model
        : `${specs.manufacturer} ${specs.model}`;
      return `${intro}\n\nYour laptop is an **${displayModel}** (${specs.systemType}).`;
    }

    case "CPU":
      return `${intro}\n\nYour laptop is powered by an **${specs.cpuName}** featuring **${specs.cpuCores} physical cores**, **${specs.cpuLogicalProcessors} logical threads**, running at a base clock of **${(specs.cpuBaseSpeedMhz / 1000).toFixed(2)} GHz**.`;

    case "RAM":
      return `${intro}\n\nYour laptop is equipped with **${specs.totalMemoryGb.toFixed(1)} GB** of total RAM. Currently, **${specs.usedMemoryGb.toFixed(1)} GB** is in active use (**${specs.memoryUsagePercent}%**), with **${specs.freeMemoryGb.toFixed(1)} GB** available.`;

    case "CPU_RAM":
      return `${intro}\n\nHere are your processor and memory specifications, sir:\n- **Processor (CPU):** ${specs.cpuName} (${specs.cpuCores} Cores / ${specs.cpuLogicalProcessors} Threads @ ${(specs.cpuBaseSpeedMhz / 1000).toFixed(2)} GHz)\n- **Installed Memory (RAM):** ${specs.totalMemoryGb.toFixed(1)} GB Total (${specs.freeMemoryGb.toFixed(1)} GB Free, ${specs.memoryUsagePercent}% in use)`;

    case "GPU": {
      const gpuList = specs.gpus.length > 0
        ? specs.gpus
            .map((g) => `- **${g.name}**${g.vramMb > 0 ? ` (${(g.vramMb / 1024).toFixed(1)} GB VRAM)` : ""}${g.driverVersion !== "Unavailable" ? ` · Driver: ${g.driverVersion}` : ""}`)
            .join("\n")
        : `- **${specs.primaryGpu}**`;
      return `${intro}\n\nYour laptop features the following graphics processor, sir:\n${gpuList}`;
    }

    case "STORAGE": {
      const diskList = specs.disks.length > 0
        ? specs.disks
            .map((d) => `- **Drive ${d.drive}** (${d.label}): **${d.freeGb} GB free** of ${d.totalGb} GB (${d.percentFree}% free, ${d.percentUsed}% used)`)
            .join("\n")
        : "Storage disk details are currently unavailable.";
      return `${intro}\n\nHere is your current storage allocation, sir:\n${diskList}`;
    }

    case "OS":
      return `${intro}\n\nYour laptop is operating on **${specs.osName}** (Version **${specs.osDisplayVersion}**, OS Build **${specs.osBuild}**, **${specs.osArch}**).`;

    case "BATTERY":
      if (specs.battery.isPresent && specs.battery.percent !== null) {
        return `${intro}\n\nYour laptop battery is currently at **${specs.battery.percent}%** (${specs.battery.statusText}), sir.`;
      }
      return `${intro}\n\n${specs.battery.statusText}, sir.`;

    case "ALL_SPECS":
    default: {
      const displayModel = specs.model.toLowerCase().startsWith(specs.manufacturer.toLowerCase())
        ? specs.model
        : `${specs.manufacturer} ${specs.model}`;

      const diskList = specs.disks
        .map((d) => `  - Drive ${d.drive} (${d.label}): ${d.freeGb} GB free of ${d.totalGb} GB`)
        .join("\n");

      return `${intro}\n\nHere are the complete live specifications for your **${displayModel}**:\n\n- **Processor (CPU):** ${specs.cpuName} (${specs.cpuCores} Cores, ${specs.cpuLogicalProcessors} Threads)\n- **Installed RAM:** ${specs.totalMemoryGb.toFixed(1)} GB Total (${specs.freeMemoryGb.toFixed(1)} GB Free, ${specs.memoryUsagePercent}% in use)\n- **Graphics (GPU):** ${specs.primaryGpu}${specs.gpus[0]?.vramMb ? ` (${(specs.gpus[0].vramMb / 1024).toFixed(1)} GB VRAM)` : ""}\n- **Operating System:** ${specs.osName} (Version ${specs.osDisplayVersion}, Build ${specs.osBuild}, ${specs.osArch})\n- **Storage Allocation:**\n${diskList}\n- **Power / Battery:** ${specs.battery.statusText}\n- **System Uptime:** ${specs.uptimeHours}h ${specs.uptimeMinutes}m`;
    }
  }
}

/**
 * Builds grounding evidence block for Ollama prompts.
 */
export function buildSystemSpecsPromptSnippet(specs: SystemSpecs): string {
  const diskSummary = specs.disks
    .map((d) => `  * Drive ${d.drive} (${d.label}): ${d.freeGb} GB free of ${d.totalGb} GB total (${d.percentFree}% free)`)
    .join("\n");

  const gpuSummary = specs.gpus
    .map((g) => `  * ${g.name} (VRAM: ${g.vramMb > 0 ? (g.vramMb / 1024).toFixed(1) + " GB" : "Shared System"}, Driver: ${g.driverVersion})`)
    .join("\n");

  const displayModel = specs.model.toLowerCase().startsWith(specs.manufacturer.toLowerCase())
    ? specs.model
    : `${specs.manufacturer} ${specs.model}`;

  return `[VERIFIED LIVE WORKSTATION TELEMETRY & HARDWARE SPECIFICATIONS]
- Laptop Model: ${displayModel} (${specs.systemType})
- Processor (CPU): ${specs.cpuName} (${specs.cpuCores} Physical Cores, ${specs.cpuLogicalProcessors} Logical Processors, Base Clock: ${(specs.cpuBaseSpeedMhz / 1000).toFixed(2)} GHz)
- Installed Memory (RAM): ${specs.totalMemoryGb.toFixed(1)} GB Total Physical Memory (${specs.usedMemoryGb.toFixed(1)} GB in use, ${specs.freeMemoryGb.toFixed(1)} GB available, ${specs.memoryUsagePercent}% utilization)
- Graphics Adapters (GPU):
${gpuSummary}
- Operating System: ${specs.osName} (Version: ${specs.osDisplayVersion}, Build: ${specs.osBuild}, Architecture: ${specs.osArch})
- Storage Fixed Disks:
${diskSummary}
- Battery Status: ${specs.battery.statusText} (Battery Percentage: ${specs.battery.percent !== null ? specs.battery.percent + "%" : "N/A"})
- System Uptime: ${specs.uptimeHours} Hours, ${specs.uptimeMinutes} Minutes
- Current Host Time & Date: ${specs.currentTime}, ${specs.currentDate} (${specs.timezone})

CRITICAL GROUNDING DIRECTIVE FOR SYSTEM INQUIRIES:
When responding to questions regarding this computer's specifications, CPU, RAM, GPU, storage drives, battery, or Windows version, you MUST answer STRICTLY and EXCLUSIVELY using the verified telemetry data provided above.
DO NOT substitute specifications from memory. DO NOT claim the laptop has an Intel processor if it is AMD, or vice versa. State the exact numbers retrieved above.`;
}
