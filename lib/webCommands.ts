export interface ApprovedWebsiteCommand {
  id: "open_youtube" | "open_google";
  displayName: string;
  url: string;
}

const APPROVED_WEBSITES: ApprovedWebsiteCommand[] = [
  { id: "open_youtube", displayName: "YouTube", url: "https://www.youtube.com" },
  { id: "open_google", displayName: "Google", url: "https://www.google.com" },
];

/** Recognize a small allowlist of website-opening commands without accepting arbitrary URLs. */
export function detectApprovedWebsiteCommand(rawText: string): ApprovedWebsiteCommand | null {
  let query = rawText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  query = query.replace(/^(?:(?:hey|hi|hello|ok)\s+)?jarvis\s+/, "");
  query = query.replace(/^(?:(?:can you|could you|would you|will you|please)\s+)+/, "");
  query = query.replace(/\s+(?:please|sir|jarvis)$/, "").trim();
  query = query.replace(/^(?:open up|bring up)\s+/, "open ");

  const action = query.match(/^(?:open|launch|start|show|visit|go to|browse)\s+(.+)$/);
  if (!action) return null;

  let site = action[1].replace(/^(?:the|my)\s+/, "").trim();
  site = site.replace(
    /\s+(?:(?:as (?:a )?)?(?:website|web site|site|webpage|web page)|in (?:the )?(?:browser|chrome|edge)|on (?:the )?(?:browser|web))$/,
    ""
  ).trim();

  if (["youtube", "youtube com", "yt"].includes(site)) {
    return APPROVED_WEBSITES[0];
  }
  if (["google", "google com"].includes(site)) {
    return APPROVED_WEBSITES[1];
  }
  return null;
}
