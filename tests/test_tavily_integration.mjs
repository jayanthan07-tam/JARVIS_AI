/**
 * End-to-End Test Suite for J.A.R.V.I.S. Tavily Integration
 */

import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function pass(name, extra = "") {
  passedCount++;
  console.log(`  [PASS] ${name}${extra ? " - " + extra : ""}`);
}

function fail(name, error) {
  failedCount++;
  console.error(`  [FAIL] ${name}:`, error?.message || error);
}

console.log("==================================================");
console.log("J.A.R.V.I.S. TAVILY SEARCH INTEGRATION TEST SUITE");
console.log("==================================================\n");

// TEST GROUP 1: Direct Tavily Module Test
console.log("TEST GROUP 1: lib/tavilySearch.ts Module & Authentication");
try {
  const { getTavilyCredentials, searchTavily } = await import("../lib/tavilySearch.ts");
  
  const creds = getTavilyCredentials();
  const hasAuth = Boolean(creds.apiKey || creds.oauthToken);
  assert.ok(hasAuth, "Tavily credentials should be detected from ~/.tavily/config.json or env");
  pass("Credentials detected safely without exposing secrets", `auth method: ${creds.apiKey ? 'API Key' : 'OAuth'}`);

  console.log("  Executing live Tavily search query: 'latest artificial intelligence developments'...");
  const searchOutput = await searchTavily("latest artificial intelligence developments", 3);
  assert.ok(Array.isArray(searchOutput.results), "Results must be an array");
  assert.ok(searchOutput.results.length > 0, "Results array must not be empty");
  assert.ok(searchOutput.provider.includes("Tavily"), "Provider must identify as Tavily");

  const first = searchOutput.results[0];
  assert.ok(first.title && typeof first.title === "string", "Result must contain title");
  assert.ok(first.url && first.url.startsWith("http"), "Result must contain valid http URL");
  assert.ok(first.snippet && typeof first.snippet === "string", "Result must contain snippet");

  pass("Live Tavily search succeeded", `Provider: ${searchOutput.provider}, Count: ${searchOutput.results.length}, Top result: ${first.title.slice(0, 40)}...`);
} catch (err) {
  fail("Tavily module live search", err);
}

// TEST GROUP 2: lib/webSearch.ts Integration
console.log("\nTEST GROUP 2: lib/webSearch.ts Primary Provider & Relevance");
try {
  const { searchWeb, verifyRelevance } = await import("../lib/webSearch.ts");

  const webRes = await searchWeb("latest artificial intelligence developments", 3);
  assert.ok(webRes.results.length > 0, "searchWeb must return results");
  assert.ok(webRes.provider.includes("Tavily"), "searchWeb must prioritize Tavily");
  pass("searchWeb routes to Tavily as primary engine", `Provider: ${webRes.provider}`);

  const isRel = verifyRelevance("latest artificial intelligence developments", webRes.results);
  assert.ok(isRel, "verifyRelevance must recognize matching AI developments results");
  pass("verifyRelevance confirms topical alignment for AI query");

  const notRel = verifyRelevance("quantum gravity in subatomic strings xyz987", webRes.results);
  assert.strictEqual(notRel, false, "verifyRelevance must reject unrelated queries");
  pass("verifyRelevance rejects mismatched topics");
} catch (err) {
  fail("webSearch integration", err);
}

// TEST GROUP 3: Server-side Next.js Route GET & POST /api/search
console.log("\nTEST GROUP 3: Server-side API Route /api/search (GET & POST)");
try {
  // Test GET
  const getRes = await fetch(`${BASE_URL}/api/search?q=who+is+tony+stark&max=2`);
  assert.strictEqual(getRes.status, 200, "GET /api/search must return 200 OK");
  const getData = await getRes.json();
  assert.strictEqual(getData.success, true, "GET response success must be true");
  assert.ok(getData.results.length > 0, "GET response must include results");
  assert.ok(getData.provider.includes("Tavily"), "GET response provider must be Tavily");
  pass("GET /api/search returns verified Tavily results", `Found: ${getData.results.length} items`);

  // Test POST
  const postRes = await fetch(`${BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "latest artificial intelligence developments", maxResults: 3 }),
  });
  assert.strictEqual(postRes.status, 200, "POST /api/search must return 200 OK");
  const postData = await postRes.json();
  assert.strictEqual(postData.success, true, "POST response success must be true");
  assert.ok(postData.results.length > 0, "POST response must include results");
  assert.ok(postData.provider.includes("Tavily"), "POST response provider must be Tavily");
  pass("POST /api/search returns verified Tavily results", `Provider: ${postData.provider}`);
} catch (err) {
  fail("Server-side /api/search route", err);
}

// TEST GROUP 4: Full Chat Pipeline Grounding POST /api/chat
console.log("\nTEST GROUP 4: End-to-End Chat & Voice Grounding via /api/chat");
try {
  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Tell me the latest artificial intelligence developments" }],
    }),
  });

  assert.strictEqual(chatRes.status, 200, "POST /api/chat must return 200 OK");
  const fullText = await chatRes.text();
  assert.ok(fullText.length > 50, "Chat response must have substantial content");

  // Check Tavily indicator
  const hasTavilyIndicator = fullText.includes("via Tavily");
  assert.ok(hasTavilyIndicator, "Stream should include Tavily retrieval status");
  pass("Chat stream displays Tavily intelligence retrieval indicator");

  // Check verified sources section and clickable markdown links
  const hasSources = fullText.includes("Verified Sources") || fullText.includes("http");
  assert.ok(hasSources, "Response must include verified source links");
  pass("Chat response contains verified source references");

  // Verify markdown link format [Title](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/;
  const linkMatch = fullText.match(linkRegex);
  assert.ok(linkMatch, "Response must include clickable markdown formatted link [Title](url)");
  pass("Clickable markdown source link format verified", `Sample: [${linkMatch[1]}](${linkMatch[2]})`);

  console.log("\n  --- Snippet of Grounded J.A.R.V.I.S. Response ---");
  console.log("  " + fullText.slice(0, 320).replace(/\n/g, "\n  ") + "...\n");
} catch (err) {
  fail("Chat & Voice /api/chat grounding pipeline", err);
}

console.log("==================================================");
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
}
