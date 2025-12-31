import { assertEquals } from "@std/assert";

// Test helper function for PR title parsing
function parsePRTitle(title: string): string {
  // Trim whitespace
  const trimmed = title.trim();
  
  // Split into words
  const words = trimmed.split(/\s+/);
  
  if (words.length === 0) {
    return '';
  }
  
  // Extract first two words as ticket identifier
  const firstWord = words[0].toLowerCase();
  const secondWord = words.length > 1 ? words[1].toLowerCase() : '';
  
  let ticketId = '';
  let remainingWords: string[] = [];
  
  // Check for "no ticket" or "noticket" cases
  if (firstWord === 'no' && secondWord === 'ticket') {
    ticketId = '[no-ticket]';
    remainingWords = words.slice(2);
  } else if (firstWord === 'noticket') {
    ticketId = '[no-ticket]';
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
  let partSuffix = '';
  let featureWords = [...remainingWords];
  
  // Search from the end for "part N" pattern
  for (let i = featureWords.length - 2; i >= 0; i--) {
    if (featureWords[i].toLowerCase() === 'part' && /^\d+$/.test(featureWords[i + 1])) {
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
  const featureName = featureWords.join(' ');
  const capitalizedFeature = featureName.charAt(0).toUpperCase() + featureName.slice(1);
  
  // Construct final title
  if (partSuffix) {
    return `${ticketId} ${partSuffix} ${capitalizedFeature}`;
  } else {
    return `${ticketId} ${capitalizedFeature}`;
  }
}

// Test parsePRTitle function
Deno.test("parsePRTitle - basic ticket with feature name", () => {
  const result = parsePRTitle("Mb 80 group by parking lot");
  assertEquals(result, "[MB-80] Group by parking lot");
});

Deno.test("parsePRTitle - ticket with part suffix", () => {
  const result = parsePRTitle("Saas 1234 feature name part 1");
  assertEquals(result, "[SAAS-1234] [PART-1] Feature name");
});

Deno.test("parsePRTitle - no ticket case (two words)", () => {
  const result = parsePRTitle("no ticket feature name");
  assertEquals(result, "[no-ticket] Feature name");
});

Deno.test("parsePRTitle - noticket case (one word)", () => {
  const result = parsePRTitle("Noticket feature name");
  assertEquals(result, "[no-ticket] Feature name");
});

Deno.test("parsePRTitle - ticket only (no feature name)", () => {
  const result = parsePRTitle("MB 123");
  assertEquals(result, "[MB-123]");
});

Deno.test("parsePRTitle - multiple part occurrences (last one wins)", () => {
  const result = parsePRTitle("Mb 80 part 1 of the feature part 2");
  assertEquals(result, "[MB-80] [PART-2] Part 1 of the feature");
});

Deno.test("parsePRTitle - whitespace trimming", () => {
  const result = parsePRTitle("  Saas  1234   feature   name  ");
  assertEquals(result, "[SAAS-1234] Feature name");
});

Deno.test("parsePRTitle - case handling in ticket ID", () => {
  const result = parsePRTitle("mb 80 feature name");
  assertEquals(result, "[MB-80] Feature name");
});

Deno.test("parsePRTitle - part suffix at different positions", () => {
  const result1 = parsePRTitle("Mb 80 update feature part 3");
  assertEquals(result1, "[MB-80] [PART-3] Update feature");
  
  const result2 = parsePRTitle("Mb 80 part 2 refactor");
  assertEquals(result2, "[MB-80] [PART-2] Refactor");
  
  const result3 = parsePRTitle("Mb 80 part 2");
  assertEquals(result3, "[MB-80] [PART-2]");
});

Deno.test("parsePRTitle - no part suffix when not followed by number", () => {
  const result = parsePRTitle("Mb 80 this is part of the feature");
  assertEquals(result, "[MB-80] This is part of the feature");
});

// Test helper function for filename parsing
function parseFilename(filename: string): {
  order: number;
  timing: 'before' | 'after' | 'standalone';
  formattedAlt: string;
} {
  // Remove number prefix (e.g., "1.", "2.", "3 ", "4")
  const prefixMatch = filename.match(/^(\d+)\.?\s*/);
  const order = prefixMatch ? parseInt(prefixMatch[1]) : 0;
  const withoutPrefix = filename.replace(/^\d+\.?\s*/, '');
  
  // Convert underscores to spaces
  const normalized = withoutPrefix.replace(/_/g, ' ');
  
  // Check for trailing "before" or "after" (case-insensitive)
  // Also supports common filename suffixes like "before.png" / "after.jpg"
  const beforeMatch = normalized.match(/\s+before(?:\.[a-z0-9]+)?\s*$/i);
  const afterMatch = normalized.match(/\s+after(?:\.[a-z0-9]+)?\s*$/i);
  
  let timing: 'before' | 'after' | 'standalone' = 'standalone';
  let content = normalized.trim();
  
  if (beforeMatch) {
    timing = 'before';
    // Remove the trailing "before" from content
    content = normalized.replace(/\s+before(?:\.[a-z0-9]+)?\s*$/i, '').trim();
  } else if (afterMatch) {
    timing = 'after';
    // Remove the trailing "after" from content
    content = normalized.replace(/\s+after(?:\.[a-z0-9]+)?\s*$/i, '').trim();
  }
  
  return {
    order,
    timing,
    formattedAlt: content
  };
}

// Test parseFilename function
Deno.test("parseFilename - handles various filename formats", () => {
  // Test case 1: "1. Feature_1_before"
  const result1 = parseFilename("1. Feature_1_before");
  assertEquals(result1.order, 1);
  assertEquals(result1.timing, "before");
  assertEquals(result1.formattedAlt, "Feature 1");
  
  // Test case 2: "2.Feature 25_before"
  const result2 = parseFilename("2.Feature 25_before");
  assertEquals(result2.order, 2);
  assertEquals(result2.timing, "before");
  assertEquals(result2.formattedAlt, "Feature 25");
  
  // Test case 3: "3 Feature 32"
  const result3 = parseFilename("3 Feature 32");
  assertEquals(result3.order, 3);
  assertEquals(result3.timing, "standalone");
  assertEquals(result3.formattedAlt, "Feature 32");
  
  // Test case 4: "4feature54_after"
  const result4 = parseFilename("4feature54_after");
  assertEquals(result4.order, 4);
  assertEquals(result4.timing, "after");
  assertEquals(result4.formattedAlt, "feature54");
});

// Test helper functions (updated version)
function parseImages(htmlContent: string): Array<{alt: string, src: string, category: string, timing: 'before' | 'after' | 'standalone', order: number}> {
  const imgRegex = /<img[^>]+>/gi;
  const images: Array<{alt: string, src: string, category: string, timing: 'before' | 'after' | 'standalone', order: number}> = [];
  
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const imgTag = match[0];
    
    const altMatch = imgTag.match(/alt="([^"]+)"/i);
    const originalAlt = altMatch ? altMatch[1] : '';
    
    const srcMatch = imgTag.match(/src="([^"]+)"/i);
    const src = srcMatch ? srcMatch[1] : '';
    
    if (originalAlt && src) {
      const parsed = parseFilename(originalAlt);
      
      images.push({
        alt: parsed.formattedAlt,
        src,
        category: parsed.formattedAlt,
        timing: parsed.timing,
        order: parsed.order
      });
    }
  }
  
  // Sort by the original order from filename prefixes
  images.sort((a, b) => a.order - b.order);
  
  return images;
}

function parseImagesMarkdown(markdownContent: string): Array<{alt: string, src: string, category: string, timing: 'before' | 'after' | 'standalone', order: number}> {
  const images: Array<{alt: string, src: string, category: string, timing: 'before' | 'after' | 'standalone', order: number}> = [];
  const content = markdownContent;

  const readUntil = (startIndex: number, predicate: (char: string, index: number) => boolean): { value: string; endIndex: number } | null => {
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
    const start = content.indexOf('![', index);
    if (start === -1) break;

    const altStart = start + 2;
    const altRead = readUntil(altStart, (char, idx) => char === ']' && content[idx - 1] !== '\\');
    if (!altRead) {
      break;
    }
    const originalAlt = altRead.value;
    let cursor = altRead.endIndex + 1;

    while (cursor < content.length && /\s/.test(content[cursor])) cursor += 1;
    if (content[cursor] !== '(') {
      index = start + 2;
      continue;
    }

    const innerStart = cursor + 1;
    let depth = 1;
    cursor += 1;
    while (cursor < content.length && depth > 0) {
      const char = content[cursor];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      cursor += 1;
    }

    if (depth !== 0) {
      index = start + 2;
      continue;
    }

    const inner = content.slice(innerStart, cursor - 1).trim();
    let src = '';
    if (inner.startsWith('<')) {
      const close = inner.indexOf('>');
      if (close > 1) {
        src = inner.slice(1, close).trim();
      }
    } else {
      src = inner.split(/\s+/)[0] ?? '';
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

function parseImagesFromClipboard(clipboardContent: string): Array<{alt: string, src: string, category: string, timing: 'before' | 'after' | 'standalone', order: number}> {
  const trimmed = clipboardContent.trim();
  if (trimmed.startsWith('<img')) {
    return parseImages(trimmed);
  }
  return parseImagesMarkdown(trimmed);
}

function formatCategoryTitle(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

Deno.test("parseImages should extract image information correctly with number prefixes", () => {
  const htmlInput = `
    <img width="1170" height="2532" alt="1. Feature_1_before" src="https://github.com/user-attachments/assets/1.jpg" />
    <img width="1170" height="2532" alt="2.Feature 25_before" src="https://github.com/user-attachments/assets/2.jpg" />
    <img width="1170" height="2532" alt="3 Feature 32" src="https://github.com/user-attachments/assets/3.jpg" />
    <img width="1170" height="2532" alt="4feature54_after" src="https://github.com/user-attachments/assets/4.jpg" />
  `;
  
  const images = parseImages(htmlInput);
  
  assertEquals(images.length, 4);
  
  // Check that images are ordered correctly
  assertEquals(images[0].order, 1);
  assertEquals(images[0].alt, "Feature 1");
  assertEquals(images[0].timing, "before");
  
  assertEquals(images[1].order, 2);
  assertEquals(images[1].alt, "Feature 25");
  assertEquals(images[1].timing, "before");
  
  assertEquals(images[2].order, 3);
  assertEquals(images[2].alt, "Feature 32");
  assertEquals(images[2].timing, "standalone");
  
  assertEquals(images[3].order, 4);
  assertEquals(images[3].alt, "feature54");
  assertEquals(images[3].timing, "after");
});

Deno.test("formatCategoryTitle should format titles correctly", () => {
  assertEquals(formatCategoryTitle("Feature 1"), "Feature 1");
  assertEquals(formatCategoryTitle("Feature 25"), "Feature 25");
  assertEquals(formatCategoryTitle("my_long_category"), "My Long Category");
});

Deno.test("parseImages should handle images without number prefixes", () => {
  const htmlInput = `
    <img alt="standalone1" src="https://example.com/img1.jpg" />
    <img alt="category_before" src="https://example.com/img3.jpg" />
    <img alt="category_after" src="https://example.com/img4.jpg" />
  `;
  
  const images = parseImages(htmlInput);
  
  assertEquals(images.length, 3);
  
  // Images without number prefixes should have order 0
  assertEquals(images[0].order, 0);
  assertEquals(images[0].alt, "standalone1");
  assertEquals(images[0].timing, "standalone");
  
  assertEquals(images[1].order, 0);
  assertEquals(images[1].alt, "category");
  assertEquals(images[1].timing, "before");
  
  assertEquals(images[2].order, 0);
  assertEquals(images[2].alt, "category");
  assertEquals(images[2].timing, "after");
});

Deno.test("parseFilename - supports before/after with extensions", () => {
  const before = parseFilename("OTFB card before.png");
  assertEquals(before.order, 0);
  assertEquals(before.timing, "before");
  assertEquals(before.formattedAlt, "OTFB card");

  const after = parseFilename("OTFB card after.JPG");
  assertEquals(after.order, 0);
  assertEquals(after.timing, "after");
  assertEquals(after.formattedAlt, "OTFB card");
});

Deno.test("parseImagesMarkdown should extract Markdown images", () => {
  const md = `
![OTFB card before.png](url1.jpg)

![OTFB card after.png](url2.jpg)
`;
  const images = parseImagesMarkdown(md);
  assertEquals(images.length, 2);

  assertEquals(images[0].alt, "OTFB card");
  assertEquals(images[0].timing, "before");
  assertEquals(images[0].src, "url1.jpg");

  assertEquals(images[1].alt, "OTFB card");
  assertEquals(images[1].timing, "after");
  assertEquals(images[1].src, "url2.jpg");
});

Deno.test("parseImagesMarkdown should keep parentheses in URLs", () => {
  const md = `![X after](https://example.com/a_(b).png)`;
  const images = parseImagesMarkdown(md);
  assertEquals(images.length, 1);
  assertEquals(images[0].src, "https://example.com/a_(b).png");
  assertEquals(images[0].timing, "after");
});

Deno.test("parseImagesFromClipboard supports both HTML and Markdown", () => {
  const html = `<img alt="1. Feature_1_before" src="https://example.com/1.jpg" />`;
  const md = `![1. Feature_1_before](https://example.com/1.jpg)`;

  const htmlImages = parseImagesFromClipboard(html);
  const mdImages = parseImagesFromClipboard(md);

  assertEquals(htmlImages.length, 1);
  assertEquals(mdImages.length, 1);
  assertEquals(htmlImages[0], mdImages[0]);
});
