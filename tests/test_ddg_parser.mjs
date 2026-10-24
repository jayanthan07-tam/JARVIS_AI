async function testDDG() {
  const query = "vsb engineering college karur";
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const html = await res.text();
  const results = [];

  // Match each result block
  const blockRegex = /<div class="result results_links results_links_deep web-result ">([\s\S]*?)<\/div>\s*<\/div>/g;
  let match;

  while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
    const block = match[1];

    // Extract title & link from <a class="result__url" or <a class="result__title"
    const headingMatch = block.match(/<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) ||
                         block.match(/<a class="result__snippet"[^>]*href="([^"]+)"/);

    const titleMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) ||
                       block.match(/<h2 class="result__title">[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);

    const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    // Let's inspect raw titles and links inside the block
    const allLinks = [...block.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    
    // DuckDuckGo uddg redirect format: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
    let cleanUrl = "";
    for (const l of allLinks) {
      if (l[1].includes("uddg=")) {
        const urlParam = new URL("https:" + l[1]).searchParams.get("uddg");
        if (urlParam) {
          cleanUrl = decodeURIComponent(urlParam);
          break;
        }
      } else if (l[1].startsWith("http")) {
        cleanUrl = l[1];
        break;
      }
    }

    const title = allLinks.length > 0 ? allLinks[0][2].replace(/<[^>]+>/g, "").trim() : "";
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    if (title && cleanUrl) {
      results.push({ title, url: cleanUrl, snippet });
    }
  }

  console.log("Parsed results count:", results.length);
  for (const r of results) {
    console.log("TITLE:  ", r.title);
    console.log("URL:    ", r.url);
    console.log("SNIPPET:", r.snippet);
    console.log("---");
  }
}

testDDG();
