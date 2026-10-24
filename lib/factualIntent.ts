/**
 * Intent Classifier for Verified Information Retrieval
 * Identifies queries requiring real-world factual grounding vs conversational/code queries.
 */

export interface FactualIntentResult {
  requiresSearch: boolean;
  searchQuery: string;
  category?: "entity" | "person" | "institution" | "location" | "event" | "general_fact";
}

/**
 * Normalizes query string for intent evaluation
 */
function normalizeQuery(rawQuery: string): string {
  let q = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  q = q.replace(/^(hey\s+|hi\s+|hello\s+|ok\s+)?jarvis\s+/, "");
  q = q.replace(/^(can\s+you\s+|could\s+you\s+|would\s+you\s+|please\s+)+/, "");
  q = q.replace(/^(tell\s+me\s+(the\s+|some\s+)?|give\s+me\s+(the\s+|some\s+)?|show\s+me\s+(the\s+|some\s+)?|find\s+(me\s+)?(the\s+)?)/, "");
  q = q.replace(/\s+(jarvis|please|sir)$/, "").trim();
  return q;
}

/**
 * Determine if a user message requires verified web search retrieval.
 */
export function classifyFactualIntent(rawQuery: string): FactualIntentResult {
  const q = normalizeQuery(rawQuery);
  const words = q.split(" ").filter(Boolean);

  if (words.length === 0) {
    return { requiresSearch: false, searchQuery: "" };
  }

  // 1. Direct entity research openers: "tell about...", "tell me about...", "who is...", "what is...", "where is..."
  const entityPatterns = [
    /^(tell\s+(me\s+)?about)\s+(.+)$/,
    /^(who\s+(is|was|are|were|founded|created|invented|built|discovered|won|leads|runs|owns))\s+(.+)$/,
    /^(what\s+(is|was|are|were|happened\s+(to|in|at)))\s+(.+)$/,
    /^(where\s+(is|was|are|were))\s+(.+)$/,
    /^(when\s+(was|did|is|will))\s+(.+)$/,
    /^(information\s+(on|about))\s+(.+)$/,
    /^(details\s+(on|about|of))\s+(.+)$/,
    /^(overview\s+of)\s+(.+)$/,
    /^(latest\s+(news|updates|information|developments)\s+(on|in|about))\s+(.+)$/,
    /^(recent\s+(news|developments|updates|breakthroughs)\s+(in|on|about))\s+(.+)$/,
    /^(latest|recent)\s+(.+)$/,
    /^(current\s+(price|status|weather|stock|news|updates|developments)\s+(of|in|for|on)?\s*)(.+)$/,
    /^(news\s+(about|on|regarding)\s+)(.+)$/,
    /^(search\s+(for\s+)?|look\s+up\s+)(.+)$/,
    /^(history\s+of)\s+(.+)$/,
    /^(explain)\s+([a-z0-9\s]+(\s+college|\s+university|\s+company|\s+institute|\s+technologies|\s+ltd|\s+corp|\s+inc))$/,
  ];

  // Exclude programming or generic definitions if they match "what is a variable", "what is recursion"
  const codingConcepts = [
    "variable",
    "loop",
    "function",
    "recursion",
    "pointer",
    "closure",
    "polymorphism",
    "inheritance",
    "algorithm",
    "binary tree",
    "css",
    "html",
    "python",
    "javascript",
    "typescript",
    "react",
    "next js",
    "c",
    "c++",
    "c#",
    "rust",
    "go",
    "golang",
    "java",
    "sql",
    "git",
    "docker",
    "api",
    "json",
    "http",
    "https",
    "neural network",
    "machine learning",
    "deep learning",
    "ai",
    "artificial intelligence",
    "large language model",
    "llm",
    "gravity",
    "photosynthesis",
    "energy",
    "atom",
    "molecule",
    "inertia",
    "entropy",
    "evolution",
    "relativity",
    "calculus",
    "algebra",
    "geometry",
    "speed of light",
    "pi",
    "black hole",
    "quantum mechanics",
  ];

  for (const pattern of entityPatterns) {
    const match = q.match(pattern);
    if (match) {
      const subject = match[match.length - 1].trim();

      // Math expressions: "what is 2 + 2", "what is 10 * 5"
      if (/^[\d\s\+\-\*\/\^\(\)\.%]+$/.test(subject)) {
        return { requiresSearch: false, searchQuery: "" };
      }

      // Check if it's a coding or general science concept like "what is recursion"
      const isCodingDef = codingConcepts.some(
        (c) => subject === c || subject === `a ${c}` || subject === `an ${c}` || subject === `the ${c}`
      );
      if (isCodingDef) {
        return { requiresSearch: false, searchQuery: "" };
      }

      // Check if subject is persona or conversational
      if (
        /^(you|your\s+name|your\s+purpose|your\s+model|your\s+creator|yourself|jarvis|tony\s+stark|iron\s+man|ultron|avengers)$/.test(
          subject
        ) ||
        /^(a\s+joke|a\s+story|a\s+poem|a\s+riddle|fun\s+fact)$/.test(subject) ||
        /^(your\s+features|your\s+capabilities|your\s+directives|what\s+you\s+can\s+do)$/.test(subject)
      ) {
        return { requiresSearch: false, searchQuery: "" };
      }

      let finalQuery = subject;
      if (q.startsWith("latest ") || q.startsWith("recent ")) {
        finalQuery = q;
      }

      // Valid entity research query!
      return {
        requiresSearch: true,
        searchQuery: finalQuery,
        category: "entity",
      };
    }
  }

  // 2. Specific institutional, geographical, or corporate keywords:
  // e.g. "vsb engineering karur", "anna university ranking", "tata motors ceo"
  const institutionalKeywords = [
    "college",
    "university",
    "engineering",
    "institute",
    "school",
    "company",
    "corporation",
    "industries",
    "technologies",
    "hospital",
    "foundation",
    "karur",
    "chennai",
    "bangalore",
    "coimbatore",
    "delhi",
    "mumbai",
    "isro",
    "nasa",
    "drdo",
    "aiims",
    "iit",
    "nit",
  ];

  const hasInstitutionalTerm = institutionalKeywords.some((term) =>
    words.includes(term)
  );

  if (hasInstitutionalTerm && words.length >= 2) {
    // Check it's not a generic greeting
    return {
      requiresSearch: true,
      searchQuery: rawQuery.replace(/^(hey\s+|hi\s+|hello\s+)?jarvis\s+/i, "").trim(),
      category: "institution",
    };
  }

  // 3. Fallback: non-factual / conversational
  return {
    requiresSearch: false,
    searchQuery: "",
  };
}
