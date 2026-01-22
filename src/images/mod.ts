import type { ImageInfo } from "../types/mod.ts";

/**
 * Parses a filename with number prefix and extracts timing information
 * Examples:
 * - "1. Feature_1_before" -> { order: 1, name: "Feature 1", timing: "before" }
 * - "2.Feature 25_before" -> { order: 2, name: "Feature 25", timing: "before" }
 * - "3 Feature 32" -> { order: 3, name: "Feature 32", timing: "standalone" }
 * - "4feature54_after" -> { order: 4, name: "feature54", timing: "after" }
 * - "5 feature whatever before" -> { order: 5, name: "feature whatever", timing: "before" }
 * - "5 feature whatever after" -> { order: 5, name: "feature whatever", timing: "after" }
 */
export function parseFilename(filename: string): {
  order: number;
  timing: "before" | "after" | "standalone";
  formattedAlt: string;
} {
  // Remove number prefix (e.g., "1.", "2.", "3 ", "4")
  const prefixMatch = filename.match(/^(\d+)\.?\s*/);
  const order = prefixMatch ? parseInt(prefixMatch[1]) : 0;
  const withoutPrefix = filename.replace(/^\d+\.?\s*/, "");

  // Convert underscores to spaces
  const normalized = withoutPrefix.replace(/_/g, " ");

  // Check for trailing "before" or "after" (case-insensitive)
  // Also supports common filename suffixes like "before.png" / "after.jpg"
  const beforeMatch = normalized.match(/\s+before(?:\.[a-z0-9]+)?\s*$/i);
  const afterMatch = normalized.match(/\s+after(?:\.[a-z0-9]+)?\s*$/i);

  let timing: "before" | "after" | "standalone" = "standalone";
  let content = normalized.trim();

  if (beforeMatch) {
    timing = "before";
    // Remove the trailing "before" from content
    content = normalized.replace(/\s+before(?:\.[a-z0-9]+)?\s*$/i, "").trim();
  } else if (afterMatch) {
    timing = "after";
    // Remove the trailing "after" from content
    content = normalized.replace(/\s+after(?:\.[a-z0-9]+)?\s*$/i, "").trim();
  }

  return {
    order,
    timing,
    formattedAlt: content,
  };
}

export function parseImagesMarkdown(markdownContent: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  const content = markdownContent;

  const readUntil = (
    startIndex: number,
    predicate: (char: string, index: number) => boolean,
  ): { value: string; endIndex: number } | null => {
    let index = startIndex;
    while (index < content.length) {
      const char = content[index];
      if (predicate(char, index)) {
        return { value: content.slice(startIndex, index), endIndex: index };
      }
      index += 1;
    }
    return null;
  };

  let index = 0;
  while (index < content.length) {
    const start = content.indexOf("![", index);
    if (start === -1) break;

    const altStart = start + 2;
    const altRead = readUntil(
      altStart,
      (char, idx) => char === "]" && content[idx - 1] !== "\\",
    );
    if (!altRead) {
      break;
    }
    const originalAlt = altRead.value;
    let cursor = altRead.endIndex + 1;

    while (cursor < content.length && /\s/.test(content[cursor])) cursor += 1;
    if (content[cursor] !== "(") {
      index = start + 2;
      continue;
    }

    const innerStart = cursor + 1;
    let depth = 1;
    cursor += 1;
    while (cursor < content.length && depth > 0) {
      const char = content[cursor];
      if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      cursor += 1;
    }

    if (depth !== 0) {
      index = start + 2;
      continue;
    }

    const inner = content.slice(innerStart, cursor - 1).trim();
    let src = "";
    if (inner.startsWith("<")) {
      const close = inner.indexOf(">");
      if (close > 1) {
        src = inner.slice(1, close).trim();
      }
    } else {
      src = inner.split(/\s+/)[0] ?? "";
    }

    if (originalAlt && src) {
      const parsed = parseFilename(originalAlt);
      images.push({
        alt: parsed.formattedAlt,
        src,
        category: parsed.formattedAlt,
        timing: parsed.timing,
        order: parsed.order,
      });
    }

    index = cursor;
  }

  images.sort((a, b) => a.order - b.order);
  return images;
}

export function parseImagesFromClipboard(clipboardContent: string): ImageInfo[] {
  const trimmed = clipboardContent.trim();
  if (trimmed.startsWith("<img")) {
    return parseImages(trimmed);
  }
  return parseImagesMarkdown(trimmed);
}

/**
 * Parses HTML content and extracts image information
 */
export function parseImages(htmlContent: string): ImageInfo[] {
  const imgRegex = /<img[^>]+>/gi;
  const images: ImageInfo[] = [];

  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const imgTag = match[0];

    // Extract alt attribute
    const altMatch = imgTag.match(/alt="([^"]+)"/i);
    const originalAlt = altMatch ? altMatch[1] : "";

    // Extract src attribute
    const srcMatch = imgTag.match(/src="([^"]+)"/i);
    const src = srcMatch ? srcMatch[1] : "";

    if (originalAlt && src) {
      // Parse the filename to extract structured information
      const parsed = parseFilename(originalAlt);

      images.push({
        alt: parsed.formattedAlt,
        src,
        category: parsed.formattedAlt,
        timing: parsed.timing,
        order: parsed.order,
      });
    }
  }

  // Sort by the original order from filename prefixes
  images.sort((a, b) => a.order - b.order);

  return images;
}

/**
 * Groups images by category and creates table rows, preserving order
 */
export function groupImagesByCategory(
  images: ImageInfo[],
): {
  standaloneImages: ImageInfo[];
  pairedGroups: Map<
    string,
    { before?: ImageInfo; after?: ImageInfo; order: number }
  >;
} {
  const standaloneImages: ImageInfo[] = [];
  const pairedGroups = new Map<
    string,
    { before?: ImageInfo; after?: ImageInfo; order: number }
  >();

  for (const image of images) {
    if (image.timing === "standalone") {
      standaloneImages.push(image);
    } else {
      if (!pairedGroups.has(image.category)) {
        pairedGroups.set(image.category, { order: image.order });
      }

      const group = pairedGroups.get(image.category)!;
      group[image.timing] = image;
      // Use the earliest order number for the group
      group.order = Math.min(group.order, image.order);
    }
  }

  return { standaloneImages, pairedGroups };
}

/**
 * Converts category name to proper title case
 */
export function formatCategoryTitle(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
