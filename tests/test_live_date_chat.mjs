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
  console.log("=== TESTING LIVE J.A.R.V.I.S. CHAT ENDPOINT FOR DATE/TIME ===");
  const testCases = [
    "today what day",
    "what is today's date",
    "what time is it",
    "what day is tomorrow",
    "what is tomorrow's date",
    "what day was yesterday",
    "what was yesterday's date",
    "what is the date and time",
    "Jarvis, today what day?",
    "Hey Jarvis what is the time right now?"
  ];

  for (const query of testCases) {
    try {
      const { reply, duration } = await sendChat(query);
      console.log(`\nQuery:    "${query}"`);
      console.log(`Response: "${reply.trim()}" (${duration}ms)`);
    } catch (e) {
      console.error(`Query failed: "${query}":`, e.message);
    }
  }

  console.log("\n=== TESTING CONVERSATIONAL PROMPT WITH TEMPORAL INJECTION ===");
  try {
    const { reply, duration } = await sendChat("Can you confirm what day of the week it is and what tomorrow will be?");
    console.log(`\nQuery:    "Can you confirm what day of the week it is and what tomorrow will be?"`);
    console.log(`Response: "${reply.trim()}" (${duration}ms)`);
  } catch (e) {
    console.error("Conversational test failed:", e.message);
  }
}

runTests();
