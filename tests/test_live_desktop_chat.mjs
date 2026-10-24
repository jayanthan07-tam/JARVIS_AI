import cp from "node:child_process";

async function sendChat(message) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const reply = await res.text();
  const duration = Date.now() - start;
  return { reply, duration };
}

async function runTests() {
  console.log("=== RUNNING LIVE DESKTOP COMMAND & CHAT VERIFICATION ===");

  const testCases = [
    // 1. Supported desktop actions
    { q: "Open YouTube", expectStatus: "Opening YouTube...", expectSuccess: "YouTube has been opened" },
    { q: "Open Google", expectStatus: "Opening Google...", expectSuccess: "Google search has been opened" },
    { q: "Open Notepad", expectStatus: "Opening Notepad...", expectSuccess: "Windows Notepad is now active", cleanup: "notepad.exe" },
    { q: "Open Calculator", expectStatus: "Opening Calculator...", expectSuccess: "Windows Calculator has been launched", cleanup: "CalculatorApp.exe" },
    { q: "Open Settings", expectStatus: "Opening Windows Settings...", expectSuccess: "Windows Settings interface has been opened" },
    { q: "Open laptop settings", expectStatus: "Opening Windows Settings...", expectSuccess: "Windows Settings interface has been opened" },
    { q: "Open File Explorer", expectStatus: "Opening File Explorer...", expectSuccess: "File Explorer has been opened" },

    // 2. Date/Time checks
    { q: "What time is it?", expectSuccess: "The current time is" },
    { q: "What is today's date?", expectSuccess: "Today is" },

    // 3. Unsupported action directives
    { q: "Open Spotify", expectBlocked: "only authorized actions on the allowlist" },
    { q: "Open Discord", expectBlocked: "only authorized actions on the allowlist" },
    { q: "Open Terminal", expectBlocked: "only authorized actions on the allowlist" },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const { reply, duration } = await sendChat(tc.q);
      const trimmed = reply.trim();
      console.log(`\n--------------------------------------------------`);
      console.log(`Directive: "${tc.q}" (${duration}ms)`);
      console.log(`Response:\n${trimmed}`);

      let ok = true;
      if (tc.expectStatus && !trimmed.includes(tc.expectStatus)) {
        console.error(`FAIL: Missing status message "${tc.expectStatus}"`);
        ok = false;
      }
      if (tc.expectSuccess && !trimmed.includes(tc.expectSuccess)) {
        console.error(`FAIL: Missing success message "${tc.expectSuccess}"`);
        ok = false;
      }
      if (tc.expectBlocked && !trimmed.includes(tc.expectBlocked)) {
        console.error(`FAIL: Expected blocked message with "${tc.expectBlocked}"`);
        ok = false;
      }

      if (ok) {
        console.log(`-> TEST PASSED`);
        passed++;
      } else {
        failed++;
      }

      // Cleanup spawned test apps if needed
      if (tc.cleanup) {
        try {
          cp.execSync(`taskkill /IM ${tc.cleanup} /F`, { stdio: "ignore" });
        } catch {}
      }
    } catch (e) {
      console.error(`FAIL: Directive "${tc.q}" error:`, e.message);
      failed++;
    }
  }

  // 4. Test ordinary Ollama query
  console.log(`\n--------------------------------------------------`);
  console.log(`Testing Ordinary Ollama Query: "Status report on arc reactor containment, Jarvis."`);
  try {
    const { reply, duration } = await sendChat("Status report on arc reactor containment, Jarvis.");
    console.log(`Response (${duration}ms):\n${reply.trim()}`);
    if (reply.length > 20) {
      console.log(`-> TEST PASSED (Full LLM response generated via local Ollama)`);
      passed++;
    } else {
      console.error("FAIL: LLM response unexpectedly short.");
      failed++;
    }
  } catch (e) {
    console.error("FAIL: LLM query failed:", e.message);
    failed++;
  }

  console.log(`\n==================================================`);
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exit(1);
}

runTests();
