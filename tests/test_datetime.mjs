import { getTemporalContext, resolveDirectDateTimeQuery } from "../lib/dateTime.ts";

console.log("=== RUNNING TEMPORAL SUITE ===");

// 1. Current real-time context
const currentContext = getTemporalContext();
console.log("Current Context:", {
  timeZone: currentContext.timeZone,
  today: currentContext.today,
  tomorrow: currentContext.tomorrow,
  yesterday: currentContext.yesterday,
  dayAfterTomorrow: currentContext.dayAfterTomorrow
});

// 2. Query resolution tests
const queries = [
  "today what day",
  "what day is today",
  "what day is it",
  "today what day?",
  "Jarvis, today what day?",
  "what is today's date",
  "what's today's date?",
  "today date",
  "what time is it",
  "what's the time",
  "current time",
  "what day is tomorrow",
  "what is tomorrow's date",
  "what day was yesterday",
  "what was yesterday's date",
  "what day is the day after tomorrow",
  "what is the date and time",
  "Can you write a poem about stars?", // should be null (delegated to LLM)
  "Schedule meeting tomorrow at 3pm" // should be null (delegated to LLM)
];

let failed = 0;
for (const q of queries) {
  const ans = resolveDirectDateTimeQuery(q, currentContext);
  console.log(`Query: "${q}" -> ${ans ? ans : "[DELEGATED TO OLLAMA]"}`);
}

// 3. Test edge case: Year transition (Dec 31, 2026)
const dec31 = new Date("2026-12-31T20:00:00+05:30");
const dec31Context = getTemporalContext(dec31);
console.log("\nDec 31 2026 Transition Test:");
console.log("Today:    ", dec31Context.today.full);
console.log("Tomorrow: ", dec31Context.tomorrow.full);
console.log("Yesterday:", dec31Context.yesterday.full);

if (dec31Context.tomorrow.full !== "Friday, January 1, 2027") {
  console.error("FAIL: Dec 31 tomorrow should be Friday, January 1, 2027");
  failed++;
} else {
  console.log("PASS: Year transition handled cleanly.");
}

// 4. Test edge case: Leap year (Feb 28, 2028)
const feb28Leap = new Date("2028-02-28T14:00:00+05:30");
const feb28Context = getTemporalContext(feb28Leap);
console.log("\nFeb 28 2028 Leap Year Test:");
console.log("Today:    ", feb28Context.today.full);
console.log("Tomorrow: ", feb28Context.tomorrow.full);

if (feb28Context.tomorrow.full !== "Tuesday, February 29, 2028") {
  console.error("FAIL: Leap day 2028 tomorrow should be Tuesday, February 29, 2028");
  failed++;
} else {
  console.log("PASS: Leap year handled cleanly.");
}

if (failed === 0) {
  console.log("\nALL TEMPORAL TESTS PASSED SUCCESSFULLY!");
} else {
  process.exit(1);
}
