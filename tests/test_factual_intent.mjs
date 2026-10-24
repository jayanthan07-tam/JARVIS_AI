import { classifyFactualIntent } from "../lib/factualIntent.ts";

console.log("=== RUNNING FACTUAL INTENT CLASSIFIER SUITE ===");

const cases = [
  { q: "tell about vsb engineering karur", expectSearch: true },
  { q: "Tell me about VSB Engineering, Karur", expectSearch: true },
  { q: "who is Satya Nadella", expectSearch: true },
  { q: "what is OpenAI", expectSearch: true },
  { q: "where is Karur", expectSearch: true },
  { q: "details about ISRO Chandrayaan", expectSearch: true },
  { q: "vsb engineering college karur placement", expectSearch: true },
  { q: "what is recursion", expectSearch: false },
  { q: "what is a variable", expectSearch: false },
  { q: "what is 2 + 2", expectSearch: false },
  { q: "what is typescript", expectSearch: false },
  { q: "who is Tony Stark", expectSearch: false },
  { q: "tell me a joke", expectSearch: false },
  { q: "write a poem about stars", expectSearch: false },
  { q: "hello jarvis how are you", expectSearch: false },
  { q: "who are you", expectSearch: false }
];

let failed = 0;
for (const tc of cases) {
  const res = classifyFactualIntent(tc.q);
  if (res.requiresSearch !== tc.expectSearch) {
    console.error(`FAIL: "${tc.q}" expected requiresSearch=${tc.expectSearch}, got:`, res);
    failed++;
  } else {
    console.log(`PASS: "${tc.q}" -> Search: ${res.requiresSearch} (${res.searchQuery || "N/A"})`);
  }
}

if (failed === 0) {
  console.log("\nALL FACTUAL INTENT TESTS PASSED!");
} else {
  console.error(`FAILED ${failed} TESTS`);
  process.exit(1);
}
