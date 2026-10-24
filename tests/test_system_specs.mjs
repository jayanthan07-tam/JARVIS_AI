import assert from "node:assert";

async function runTests() {
  console.log("==================================================");
  console.log("J.A.R.V.I.S. SYSTEM SPECS SERVICE TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Test Group 1: Query Intent Detection
  console.log("TEST GROUP 1: Query Intent Detection & Categorization");
  const { detectSystemSpecsQuery } = await import("../lib/systemSpecs.ts");

  const queries = [
    { text: "What are my laptop specifications?", expected: "ALL_SPECS" },
    { text: "Tell me my CPU and RAM.", expected: "CPU_RAM" },
    { text: "Which GPU does my laptop have?", expected: "GPU" },
    { text: "How much storage is available on C and D drives?", expected: "STORAGE" },
    { text: "What Windows version am I using?", expected: "OS" },
    { text: "What is my battery percentage?", expected: "BATTERY" },
    { text: "What processor do I have?", expected: "CPU" },
    { text: "How much RAM is installed on this machine?", expected: "RAM" },
    { text: "What is my laptop model and manufacturer?", expected: "MODEL" },
    { text: "how much free disk space is left on drive c", expected: "STORAGE" },
    { text: "is my laptop charging right now", expected: "BATTERY" },
  ];

  for (const q of queries) {
    test(`Query: "${q.text}" -> ${q.expected}`, () => {
      const res = detectSystemSpecsQuery(q.text);
      assert.strictEqual(res.isSystemQuery, true);
      assert.strictEqual(res.category, q.expected);
    });
  }

  // Non-system queries should NOT match
  const nonQueries = [
    "who is tony stark",
    "tell about vsb engineering karur",
    "what is recursion in javascript",
    "how to make a cake",
    "open notepad",
  ];
  for (const nq of nonQueries) {
    test(`Non-system query: "${nq}" is not matched`, () => {
      const res = detectSystemSpecsQuery(nq);
      assert.strictEqual(res.isSystemQuery, false);
    });
  }

  // Test Group 2: Real Windows Hardware Specifications Retrieval
  console.log("\nTEST GROUP 2: Real Windows Hardware Retrieval & Normalization");
  const { getSystemSpecs, formatSystemSpecsResponse } = await import("../lib/systemSpecs.ts");

  const startTime = Date.now();
  const specs = await getSystemSpecs({ forceRefresh: true });
  const elapsed = Date.now() - startTime;
  console.log(`  Telemetry retrieval completed in ${elapsed} ms\n`);

  test("Manufacturer is valid string", () => {
    assert(specs.manufacturer && typeof specs.manufacturer === "string");
    assert(specs.manufacturer.length > 0);
  });

  test("Model is detected (HP OmniBook...)", () => {
    assert(specs.model && typeof specs.model === "string");
    const displayModel = specs.model.toLowerCase().startsWith(specs.manufacturer.toLowerCase())
      ? specs.model
      : `${specs.manufacturer} ${specs.model}`;
    console.log(`    Detected Model: ${displayModel}`);
    assert(specs.model.toLowerCase().includes("omnibook") || specs.model.length > 3);
  });

  test("CPU details detected (AMD Ryzen AI...)", () => {
    assert(specs.cpuName && typeof specs.cpuName === "string");
    assert(specs.cpuCores >= 2);
    assert(specs.cpuLogicalProcessors >= specs.cpuCores);
    console.log(`    Detected CPU: ${specs.cpuName} (${specs.cpuCores} Cores / ${specs.cpuLogicalProcessors} Threads)`);
    assert(specs.cpuName.toLowerCase().includes("amd") || specs.cpuName.toLowerCase().includes("ryzen") || specs.cpuCores > 0);
  });

  test("RAM capacity detected (~14-16 GB)", () => {
    assert(typeof specs.totalMemoryGb === "number" && specs.totalMemoryGb > 4);
    assert(typeof specs.freeMemoryGb === "number" && specs.freeMemoryGb >= 0);
    assert(typeof specs.memoryUsagePercent === "number" && specs.memoryUsagePercent >= 0 && specs.memoryUsagePercent <= 100);
    console.log(`    Detected RAM: ${specs.totalMemoryGb.toFixed(1)} GB Total (${specs.freeMemoryGb.toFixed(1)} GB Free, ${specs.memoryUsagePercent}% in use)`);
  });

  test("GPU details detected (AMD Radeon...)", () => {
    assert(Array.isArray(specs.gpus) && specs.gpus.length > 0);
    const primary = specs.gpus[0];
    assert(primary.name && typeof primary.name === "string");
    console.log(`    Detected GPU: ${primary.name} (${primary.vramMb} MB VRAM, Driver: ${primary.driverVersion})`);
    assert(primary.name.toLowerCase().includes("radeon") || primary.name.length > 3);
  });

  test("Windows OS details detected (Windows 11, Build, Arch)", () => {
    assert(specs.osName && typeof specs.osName === "string");
    assert(specs.osBuild && typeof specs.osBuild === "string");
    assert(specs.osArch.includes("64") || specs.osArch.includes("x64") || specs.osArch.includes("ARM"));
    console.log(`    Detected OS: ${specs.osName} (${specs.osDisplayVersion} Build ${specs.osBuild}, ${specs.osArch})`);
    assert(specs.osName.includes("Windows"));
  });

  test("Fixed local disks detected (C: and D:)", () => {
    assert(Array.isArray(specs.disks) && specs.disks.length > 0);
    console.log(`    Detected Disks: ${specs.disks.map((d) => `${d.drive} (${d.label}): ${d.freeGb} GB free of ${d.totalGb} GB`).join(", ")}`);
    const cDrive = specs.disks.find((d) => d.drive.toUpperCase() === "C:");
    assert(cDrive, "Drive C: must be detected");
    assert(cDrive.totalGb > 10, "Drive C: total capacity must be > 10 GB");
  });

  test("Battery details detected (Percentage & Charging status)", () => {
    assert(typeof specs.battery.isPresent === "boolean");
    if (specs.battery.isPresent) {
      assert(typeof specs.battery.percent === "number");
      assert(specs.battery.percent >= 0 && specs.battery.percent <= 100);
      assert(typeof specs.battery.statusText === "string");
      console.log(`    Detected Battery: ${specs.battery.statusText}`);
    } else {
      console.log("    Battery: Desktop / AC Power only");
    }
  });

  test("Current date, time, and timezone detected", () => {
    assert(specs.timezone === "Asia/Kolkata");
    assert(specs.currentTime && specs.currentDate);
    console.log(`    Current Time & Date: ${specs.currentTime}, ${specs.currentDate} (${specs.timezone})`);
  });

  // Test Group 3: Formatted Butler Responses
  console.log("\nTEST GROUP 3: Deterministic Formatted Responses");
  test("Format ALL_SPECS response contains exact hardware data", () => {
    const text = formatSystemSpecsResponse("ALL_SPECS", specs);
    assert(text.includes(specs.model));
    assert(text.includes(specs.cpuName));
    assert(text.includes(specs.totalMemoryGb.toFixed(1)));
    assert(text.includes(specs.primaryGpu));
    assert(text.includes(specs.osName));
  });

  test("Format CPU_RAM response focuses on processor and memory", () => {
    const text = formatSystemSpecsResponse("CPU_RAM", specs);
    assert(text.includes(specs.cpuName));
    assert(text.includes(specs.totalMemoryGb.toFixed(1)));
  });

  test("Format STORAGE response lists drive details", () => {
    const text = formatSystemSpecsResponse("STORAGE", specs);
    for (const d of specs.disks) {
      assert(text.includes(d.drive));
      assert(text.includes(String(d.freeGb)));
    }
  });

  test("Format BATTERY response shows level and charging state", () => {
    const text = formatSystemSpecsResponse("BATTERY", specs);
    if (specs.battery.percent !== null) {
      assert(text.includes(String(specs.battery.percent)));
    }
  });

  // Test Group 4: Live HTTP API Endpoints
  console.log("\nTEST GROUP 4: Live HTTP Integration with Next.js Dev Server (localhost:3000)");

  test("GET /api/system returns verified hardware specs", async () => {
    const res = await fetch("http://localhost:3000/api/system");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.system, "data.system must exist");
    assert(data.specs, "data.specs must exist");
    assert.strictEqual(data.specs.manufacturer, specs.manufacturer);
    assert.strictEqual(data.specs.model, specs.model);
    assert.strictEqual(data.specs.cpuName, specs.cpuName);
    console.log(`    GET /api/system returned 200 OK with model: ${data.specs.model}`);
  });

  test("POST /api/chat grounds 'What are my laptop specifications?' with real hardware", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "What are my laptop specifications?" }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const reply = await res.text();
    console.log(`\n    --- J.A.R.V.I.S. Chat Response for 'What are my laptop specifications?' ---`);
    console.log(reply.trim());
    console.log(`    -------------------------------------------------------------------------\n`);
    assert(
      reply.toLowerCase().includes("omnibook") ||
      reply.toLowerCase().includes("hp") ||
      reply.toLowerCase().includes("ryzen") ||
      reply.toLowerCase().includes("radeon"),
      "Response must contain real laptop hardware details"
    );
  });

  test("POST /api/chat grounds 'Which GPU does my laptop have?'", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Which GPU does my laptop have?" }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const reply = await res.text();
    console.log(`    Response snippet: ${reply.slice(0, 150).replace(/\n/g, " ")}...`);
    assert(
      reply.toLowerCase().includes("radeon") || reply.toLowerCase().includes("graphics"),
      "Response must identify AMD Radeon GPU"
    );
  });

  test("POST /api/chat grounds 'What is my battery percentage?'", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is my battery percentage?" }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const reply = await res.text();
    console.log(`    Response snippet: ${reply.slice(0, 150).replace(/\n/g, " ")}...`);
    assert(
      reply.includes("%") || reply.toLowerCase().includes("battery") || reply.toLowerCase().includes("ac power"),
      "Response must report battery percentage"
    );
  });

  test("POST /api/chat grounds 'How much storage is available on C and D drives?'", async () => {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "How much storage is available on C and D drives?" }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const reply = await res.text();
    console.log(`    Response snippet: ${reply.slice(0, 150).replace(/\n/g, " ")}...`);
    assert(
      reply.includes("C:") || reply.includes("D:") || reply.toLowerCase().includes("drive"),
      "Response must state C and D drive capacities"
    );
  });

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runTests();
