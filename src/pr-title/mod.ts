/**
 * Parses a PR title and formats it with ticket identifier and optional part suffix
 * Examples:
 * - "Mb 80 group by parking lot" -> "[MB-80] Group by parking lot"
 * - "Saas 1234 feature name part 1" -> "[SAAS-1234] [PART-1] Feature name"
 * - "no ticket feature name" -> "[no-ticket] Feature name"
 * - "Noticket feature name" -> "[no-ticket] Feature name"
 * - "MB 123" -> "[MB-123]"
 */
export function parsePRTitle(title: string): string {
  // Trim whitespace
  const trimmed = title.trim();

  const slashSlugMatch = trimmed.match(/^([A-Za-z]+)-(\d+)(?:-[^/]+)?\/(.+)$/);
  const hyphenSlugMatch = trimmed.match(/^([A-Za-z]+)-(\d+)-(.+)$/);
  let words: string[] = [];
  const match = slashSlugMatch ?? hyphenSlugMatch;
  if (match) {
    const ticketPrefix = match[1];
    const ticketNumber = match[2];
    const featureSlug = match[3];
    const featureWords = featureSlug
      .replace(/[_-]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    words = [ticketPrefix, ticketNumber, ...featureWords];
  } else {
    // Split into words
    words = trimmed.split(/\s+/);
  }

  if (words.length === 0) {
    return "";
  }

  // Extract first two words as ticket identifier
  const firstWord = words[0].toLowerCase();
  const secondWord = words.length > 1 ? words[1].toLowerCase() : "";

  let ticketId = "";
  let remainingWords: string[] = [];

  // Check for "no ticket" or "noticket" cases
  if (firstWord === "no" && secondWord === "ticket") {
    ticketId = "[no-ticket]";
    remainingWords = words.slice(2);
  } else if (firstWord === "noticket") {
    ticketId = "[no-ticket]";
    remainingWords = words.slice(1);
  } else if (words.length >= 2) {
    // Normal ticket ID: first two words
    ticketId = `[${words[0].toUpperCase()}-${words[1].toUpperCase()}]`;
    remainingWords = words.slice(2);
  } else {
    // Only one word - treat as ticket without number
    ticketId = `[${words[0].toUpperCase()}]`;
    remainingWords = [];
  }

  // If no remaining words, return just the ticket ID
  if (remainingWords.length === 0) {
    return ticketId;
  }

  // Look for the last "part N" pattern in remaining words
  let partSuffix = "";
  let featureWords = [...remainingWords];

  // Search from the end for "part N" pattern
  for (let i = featureWords.length - 2; i >= 0; i--) {
    if (
      featureWords[i].toLowerCase() === "part" &&
      /^\d+$/.test(featureWords[i + 1])
    ) {
      partSuffix = `[PART-${featureWords[i + 1]}]`;
      // Keep words before "part N" and words after "part N"
      const beforePart = featureWords.slice(0, i);
      const afterPart = featureWords.slice(i + 2);
      featureWords = [...beforePart, ...afterPart];
      break;
    }
  }

  // If no feature words left after removing part suffix, return ticket + part only
  if (featureWords.length === 0 && partSuffix) {
    return `${ticketId} ${partSuffix}`;
  }

  // Join feature words and capitalize first letter
  const featureName = featureWords.join(" ");
  const capitalizedFeature = featureName.charAt(0).toUpperCase() +
    featureName.slice(1);

  // Construct final title
  if (partSuffix) {
    return `${ticketId} ${partSuffix} ${capitalizedFeature}`;
  }
  return `${ticketId} ${capitalizedFeature}`;
}
