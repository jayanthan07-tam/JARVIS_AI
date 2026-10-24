import { searchWeb } from "../lib/webSearch.ts";

async function testGroundedOllama() {
  console.log("=== TESTING GROUNDED OLLAMA FOR VSB ENGINEERING KARUR ===");

  const searchRes = await searchWeb("vsb engineering karur");
  console.log("Provider:", searchRes.provider);
  console.log("Results count:", searchRes.results.length);

  const evidence = searchRes.results
    .map(
      (r, i) =>
        `[Source ${i + 1}]: "${r.title}"\nURL: ${r.url}\nExcerpt: ${r.snippet}`
    )
    .join("\n\n");

  const sourcesList = searchRes.results
    .slice(0, 3)
    .map((r) => `- [${r.title}](${r.url})`)
    .join("\n");

  const systemPrompt = `You are J.A.R.V.I.S., the tactical AI assistant created by Tony Stark.
You are running locally on the user's workstation.
[VERIFIED EVIDENCE RETRIEVED FROM REAL-TIME WEB SEARCH]
${evidence}

CRITICAL DIRECTIVES:
- Base your factual statements strictly on the verified evidence provided above.
- Do NOT invent fictional products, clients, or industrial manufacturing claims. Notice that V.S.B. Engineering College is an engineering institution in Karur, Tamil Nadu.
- Address the user respectfully as sir.
- List the verified sources at the end formatted as:
**Verified Sources:**
${sourcesList}`;

  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2:3b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "tell about vsb engineering karur" },
      ],
      options: { temperature: 0.2 },
      stream: false,
    }),
  });

  const data = await res.json();
  console.log("\n=== MODEL RESPONSE ===\n", data.message.content);
}

testGroundedOllama();
