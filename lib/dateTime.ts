/**
 * Temporal context and date/time calculation engine for J.A.R.V.I.S.
 * Timezone strictly anchored to Asia/Kolkata (IST, UTC+5:30).
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface DateItem {
  day: string; // e.g. "Monday"
  full: string; // e.g. "Monday, October 12, 2026"
  monthDayYear: string; // e.g. "October 12, 2026"
  isoDate: string; // e.g. "2026-10-12"
  time12?: string; // e.g. "12:30 PM"
  time24?: string; // e.g. "12:30"
}

export interface TemporalContext {
  timeZone: string;
  today: DateItem;
  tomorrow: DateItem;
  yesterday: DateItem;
  dayAfterTomorrow: DateItem;
  systemPromptSnippet: string;
}

/**
 * Accurately calculate calendar dates and times for a given reference date and timezone.
 * Uses UTC calendar date projection based on the local timezone calendar date string (YYYY-MM-DD)
 * to safely handle month/year transitions, leap years, and daylight shifts.
 */
export function getTemporalContext(
  refDate: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): TemporalContext {
  // 1. Extract local calendar date in the target timezone (YYYY-MM-DD)
  const localDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(refDate);

  const [year, month, day] = localDateStr.split("-").map(Number);

  // 2. Construct noon UTC dates to avoid any daylight-saving boundary shifts
  const todayUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const tomorrowUtc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  const yesterdayUtc = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0));
  const dayAfterTomorrowUtc = new Date(Date.UTC(year, month - 1, day + 2, 12, 0, 0));

  const formatDateItem = (utcDate: Date): DateItem => {
    const full = utcDate.toLocaleDateString("en-US", {
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const dayName = utcDate.toLocaleDateString("en-US", {
      timeZone: "UTC",
      weekday: "long",
    });
    const monthDayYear = utcDate.toLocaleDateString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const isoDate = utcDate.toISOString().slice(0, 10);
    return { day: dayName, full, monthDayYear, isoDate };
  };

  const time12 = refDate.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const time24 = refDate.toLocaleTimeString("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const today: DateItem = {
    ...formatDateItem(todayUtc),
    time12,
    time24,
  };

  const tomorrow = formatDateItem(tomorrowUtc);
  const yesterday = formatDateItem(yesterdayUtc);
  const dayAfterTomorrow = formatDateItem(dayAfterTomorrowUtc);

  const systemPromptSnippet = `[REAL-TIME TEMPORAL CONTEXT]
- Timezone: ${timeZone} (Indian Standard Time, UTC+5:30)
- Current Time: ${today.time12} IST (${today.time24} hrs)
- Current Day of the Week: ${today.day}
- Current Date: ${today.full} (Date: ${today.isoDate})
- Authoritative Current Year: ${today.isoDate.slice(0, 4)}
- Yesterday: ${yesterday.day}, ${yesterday.full}
- Tomorrow: ${tomorrow.day}, ${tomorrow.full}
- Day After Tomorrow: ${dayAfterTomorrow.day}, ${dayAfterTomorrow.full}
CRITICAL INSTRUCTION: These live clock values override the model's older training data. Use them for questions about today, the current date or year, time, tomorrow, yesterday, or schedules. Never answer those from training memory or guess another date.`;

  return {
    timeZone,
    today,
    tomorrow,
    yesterday,
    dayAfterTomorrow,
    systemPromptSnippet,
  };
}

/**
 * Normalizes user queries for intent extraction
 */
function cleanQuery(rawQuery: string): string {
  let q = rawQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip conversational address headers
  q = q.replace(/^(hey\s+|hi\s+|hello\s+|ok\s+)?jarvis\s+/, "");
  // Strip question openers (supports combined phrases like 'can you please tell me')
  q = q.replace(/^(can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|please\s+)*(tell\s+me\s+)?/, "");
  // Strip trailing polite titles
  q = q.replace(/\s+(for\s+me|right\s+now|now|jarvis|please|sir|thanks|thank\s+you)$/, "").trim();

  return q;
}

/**
 * Resolves direct date and time questions deterministically using real calculated values.
 * Returns a styled J.A.R.V.I.S. response string, or null if the query is not a direct date/time question.
 */
export function resolveDirectDateTimeQuery(
  rawQuery: string,
  temporal: TemporalContext
): string | null {
  const q = cleanQuery(rawQuery);
  const { today, tomorrow, yesterday, dayAfterTomorrow } = temporal;

  // Resolve the year directly so the model's older training data cannot override the live clock.
  if (
    /^(what\s+(?:is|s)\s+(?:the\s+)?(?:current\s+)?year|what\s+year\s+is\s+it|which\s+year\s+is\s+it|current\s+year|year\s+today|today\s+year)$/.test(q)
  ) {
    return `The current year is ${today.isoDate.slice(0, 4)}, sir.`;
  }

  // 1. Day after tomorrow
  if (
    q.includes("day after tomorrow") ||
    /^(what\s+day\s+is\s+the\s+day\s+after\s+tomorrow|what\s+day\s+is\s+day\s+after\s+tomorrow|day\s+after\s+tomorrow\s+what\s+day)$/.test(q)
  ) {
    if (q.includes("date")) {
      return `The date for the day after tomorrow will be ${dayAfterTomorrow.full}, sir.`;
    }
    return `The day after tomorrow is ${dayAfterTomorrow.day}, ${dayAfterTomorrow.monthDayYear}, sir.`;
  }

  // 2. Yesterday queries
  if (
    /^(what\s+day\s+(was|is)\s+yesterday|yesterday\s+what\s+day|which\s+day\s+was\s+yesterday|what\s+day\s+was\s+it\s+yesterday)$/.test(q) ||
    q === "yesterday day"
  ) {
    return `Yesterday was ${yesterday.day}, ${yesterday.monthDayYear}, sir.`;
  }

  if (
    /^(what\s+(was|is)\s+yesterday\s+s?\s*date|what\s+(was|is)\s+the\s+date\s+yesterday|yesterday\s+date|yesterday\s+s\s+date)$/.test(q)
  ) {
    return `Yesterday's date was ${yesterday.full}, sir.`;
  }

  // 3. Tomorrow queries
  if (
    /^(what\s+day\s+(is|will\s+be)\s+(it\s+)?tomorrow|tomorrow\s+what\s+day|which\s+day\s+is\s+tomorrow|what\s+is\s+tomorrow\s+s?\s*day|what\s+day\s+tomorrow)$/.test(q) ||
    q === "tomorrow day"
  ) {
    return `Tomorrow is ${tomorrow.day}, ${tomorrow.monthDayYear}, sir.`;
  }

  if (
    /^(what\s+(is|will\s+be)\s+tomorrow\s+s?\s*date|what\s+date\s+is\s+tomorrow|what\s+is\s+the\s+date\s+tomorrow|tomorrow\s+date|tomorrow\s+s\s+date)$/.test(q)
  ) {
    return `Tomorrow's date will be ${tomorrow.full}, sir.`;
  }

  if (q === "what is tomorrow" || q === "what day tomorrow") {
    return `Tomorrow will be ${tomorrow.day}, ${tomorrow.monthDayYear}, sir.`;
  }

  // 4. Combined Date & Time queries
  if (
    q.includes("date and time") ||
    q.includes("time and date") ||
    /^(what\s+is\s+(the\s+)?current\s+date\s+and\s+time|current\s+date\s+and\s+time)$/.test(q)
  ) {
    return `Today is ${today.day}, ${today.monthDayYear}, and the current time is ${today.time12} IST, sir.`;
  }

  // 5. Time queries (including 'in India' / IST)
  if (
    q.includes("time in india") ||
    q.includes("time is it in india") ||
    /^(what\s+time\s+is\s+it(\s+in\s+india)?(\s+now|\s+right\s+now)?|what\s+s\s+the\s+time(\s+in\s+india)?|what\s+is\s+the\s+time(\s+in\s+india)?|current\s+time(\s+in\s+india)?|time\s+right\s+now|time\s+now|what\s+is\s+the\s+current\s+time(\s+in\s+india)?|what\s+time(\s+in\s+india)?|the\s+time(\s+in\s+india)?)$/.test(q) ||
    /time\s+(is\s+it\s+)?in\s+india/.test(q)
  ) {
    if (q.includes("india")) {
      return `The current time in India is ${today.time12} IST, sir.`;
    }
    return `The current time is ${today.time12} IST, sir.`;
  }

  // 6. Day and Date combined
  if (q.includes("day and date") || q.includes("date and day")) {
    return `Today is ${today.day}, and the date is ${today.full}, sir.`;
  }

  // 7. Day queries (e.g. "today what day", "what day is today", "what day is it")
  if (
    /^(today\s+what\s+day|what\s+day\s+is\s+(it\s+)?today|what\s+day\s+is\s+it|which\s+day\s+is\s+(it\s+)?today|what\s+is\s+today\s+s?\s*day|what\s+s\s+today\s+s?\s*day|what\s+is\s+the\s+day\s+today|today\s+day|day\s+today)$/.test(q)
  ) {
    return `Today is ${today.day}, ${today.monthDayYear}, sir.`;
  }

  // 8. Date queries (e.g. "what is today's date", "what's today's date", "today date")
  if (
    /^(what\s+is\s+today\s+s?\s*date|what\s+s\s+today\s+s?\s*date|what\s+is\s+the\s+date\s+(today)?|what\s+date\s+is\s+(it\s+)?today|today\s+date|today\s+s\s+date|what\s+is\s+the\s+date|what\s+s\s+the\s+date|what\s+s\s+current\s+date|current\s+date|what\s+is\s+(?:the\s+)?current\s+date|what\s+s\s+(?:the\s+)?current\s+date|what\s+date\s+is\s+it)$/.test(q)
  ) {
    return `Today is ${today.day}, and the date is ${today.full}, sir.`;
  }

  return null;
}
