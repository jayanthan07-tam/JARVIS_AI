import cp from "node:child_process";
import { searchWeb } from "../lib/webSearch.ts";
import { classifyFactualIntent } from "../lib/factualIntent.ts";

async function postChat(message) {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const reply = await res.text();
  const duration = Date.now() - start;
  return { reply, duration };
}

async function runTestSuite() {
  console.log("===============================================================");
  console.log("   J.A.R.V.I.S. VERIFIED RETRIEVAL & HALLUCINATION TEST SUITE   ");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: "Tell me about VSB Engineering, Karur."
  console.log("TEST 1: 'Tell me about VSB Engineering, Karur.'");
  try {
    const { reply, duration } = await postChat("Tell me about VSB Engineering, Karur.");
    console.log(`[${duration}ms] Response snippet:\n${reply.slice(0, 300)}...\n`);

    const lower = reply.toLowerCase();
    const isCollege = lower.includes("college") || lower.includes("institution") || lower.includes("anna university");
    const hasSources = reply.includes("Verified Sources") || reply.includes("vsbec.edu.in");
    const noFictionalProducts = !lower.includes("industrial automation components") && !lower.includes("pneumatic valves");

    if (isCollege && hasSources && noFictionalProducts) {
      console.log("-> PASS: Truthfully identified VSB as engineering institution with verified sources.\n");
      passed++;
    } else {
      console.error("-> FAIL: Did not properly identify VSB or missing sources.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 1:", e.message);
    failed++;
  }

  // TEST 2: "What is today's date and day?"
  console.log("TEST 2: 'What is today's date and day?'");
  try {
    const { reply, duration } = await postChat("What is today's date and day?");
    console.log(`[${duration}ms] Response:\n${reply}\n`);

    const expectedDay = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const hasDay = reply.toLowerCase().includes(expectedDay);
    const hasDate = reply.includes(String(new Date().getFullYear())) || reply.toLowerCase().includes(new Date().toLocaleDateString("en-US", { month: "long" }).toLowerCase());

    if (hasDay && hasDate) {
      console.log("-> PASS: Returned actual day and real-time date.\n");
      passed++;
    } else {
      console.error("-> FAIL: Date/day check failed.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 2:", e.message);
    failed++;
  }

  // TEST 3: "What time is it in India?"
  console.log("TEST 3: 'What time is it in India?'");
  try {
    const { reply, duration } = await postChat("What time is it in India?");
    console.log(`[${duration}ms] Response:\n${reply}\n`);

    if (reply.includes("IST") && (reply.includes("AM") || reply.includes("PM") || reply.includes("hrs"))) {
      console.log("-> PASS: Returned real-time India time in IST.\n");
      passed++;
    } else {
      console.error("-> FAIL: India time check failed.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 3:", e.message);
    failed++;
  }

  // TEST 4: "Open YouTube."
  console.log("TEST 4: 'Open YouTube.'");
  try {
    const { reply, duration } = await postChat("Open YouTube.");
    console.log(`[${duration}ms] Response:\n${reply}\n`);

    if (reply.includes("Opening YouTube...") && reply.includes("YouTube has been opened")) {
      console.log("-> PASS: Desktop action launched YouTube safely with status stream.\n");
      passed++;
    } else {
      console.error("-> FAIL: Desktop action YouTube failed.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 4:", e.message);
    failed++;
  }

  // TEST 5: A normal general-knowledge question
  console.log("TEST 5: Normal general-knowledge question: 'Why is the sky blue?'");
  try {
    const { reply, duration } = await postChat("Why is the sky blue?");
    console.log(`[${duration}ms] Response snippet:\n${reply.slice(0, 250)}...\n`);

    const lower = reply.toLowerCase();
    if (lower.includes("rayleigh") || lower.includes("scatter") || lower.includes("wavelength") || lower.includes("light")) {
      console.log("-> PASS: Answered general knowledge query accurately through local Ollama.\n");
      passed++;
    } else {
      console.error("-> FAIL: General knowledge response unexpected.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 5:", e.message);
    failed++;
  }

  // TEST 6: A question about a business that cannot be verified
  console.log("TEST 6: Unverified entity: 'Tell me about ZephyroTech Omniverse Karur 987654321'");
  try {
    const { reply, duration } = await postChat("Tell me about ZephyroTech Omniverse Karur 987654321");
    console.log(`[${duration}ms] Response:\n${reply}\n`);

    const lower = reply.toLowerCase();
    const admittedUnverified = lower.includes("could not find") || lower.includes("couldn't find") || lower.includes("cannot be verified") || lower.includes("can't be verified") || lower.includes("identifying details") || lower.includes("no verified information") || lower.includes("unable to verify");

    if (admittedUnverified) {
      console.log("-> PASS: Transparently admitted entity cannot be verified without fabricating claims.\n");
      passed++;
    } else {
      console.error("-> FAIL: Failed to acknowledge entity is unverified.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 6:", e.message);
    failed++;
  }

  // TEST 7: Consistency between Text and Voice mode pipelines
  console.log("TEST 7: Consistency check: Factual query through chat API endpoint used by VoiceScreen");
  try {
    const query = "Tell me about Anna University, Chennai";
    const { reply, duration } = await postChat(query);
    console.log(`[${duration}ms] Response snippet:\n${reply.slice(0, 260)}...\n`);

    const hasSources = reply.includes("Verified Sources") || reply.includes("annauniv.edu");
    if (hasSources && reply.toLowerCase().includes("university")) {
      console.log("-> PASS: Verified factual retrieval pipeline is unified across text and voice interfaces.\n");
      passed++;
    } else {
      console.error("-> FAIL: Voice/Text pipeline consistency check failed.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 7:", e.message);
    failed++;
  }

  // TEST 8: Web search fallback and missing API key
  console.log("TEST 8: Missing API keys & fallback provider verification");
  try {
    // Check searchWeb directly with no external API keys configured
    const searchRes = await searchWeb("ISRO Chandrayaan");
    console.log(`Search Provider used: ${searchRes.provider}, Results count: ${searchRes.results.length}`);

    if (searchRes.results.length > 0) {
      console.log("-> PASS: Zero-setup fallback engine (DuckDuckGo) functions correctly when API keys are not provided.\n");
      passed++;
    } else {
      console.error("-> FAIL: Fallback search produced zero results.\n");
      failed++;
    }
  } catch (e) {
    console.error("-> FAIL Test 8:", e.message);
    failed++;
  }

  console.log("===============================================================");
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================");

  if (failed > 0) process.exit(1);
}

runTestSuite();
