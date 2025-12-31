interface ImageInfo {
  alt: string;
  src: string;
  category: string;
  timing: 'before' | 'after' | 'standalone';
  order: number; // For preserving custom ordering
}

/**
 * Checks if the app is running from the app bundle
 */
function isRunningFromApp(): boolean {
  const execPath = Deno.execPath();
  return execPath.includes('.app/') || Deno.args.includes('--app-mode');
}

/**
 * Shows a macOS dialog using osascript
 */
async function showDialog(message: string, title: string = "PR Parser", type: 'info' | 'error' = 'info'): Promise<void> {
  if (!isRunningFromApp()) {
    console.log(`${type === 'error' ? '❌' : '✅'} ${title}: ${message}`);
    return;
  }

  const iconType = type === 'error' ? 'stop' : 'note';
  const script = `display dialog "${message.replace(/"/g, '\\"')}" with title "${title}" buttons {"OK"} default button "OK" with icon ${iconType}`;
  
  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped"
  });
  
  await process.output();
}

/**
 * Shows a progress notification
 */
async function showProgress(message: string): Promise<void> {
  if (!isRunningFromApp()) {
    console.log(message);
    return;
  }

  const script = `display notification "${message.replace(/"/g, '\\"')}" with title "PR Parser"`;
  
  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped"
  });
  
  await process.output();
}

/**
 * Reads HTML content from the clipboard
 */
async function readClipboard(): Promise<string> {
  const process = new Deno.Command("pbpaste", {
    stdout: "piped",
    stderr: "piped"
  });
  
  const output = await process.output();
  
  if (!output.success) {
    throw new Error("Failed to read clipboard");
  }
  
  return new TextDecoder().decode(output.stdout);
}

/**
 * Writes content to the clipboard
 */
async function writeClipboard(content: string): Promise<void> {
  const process = new Deno.Command("pbcopy", {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped"
  });
  
  const child = process.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(content));
  await writer.close();
  
  const output = await child.output();
  
  if (!output.success) {
    throw new Error("Failed to write to clipboard");
  }
}

/**
 * Simulates Cmd+V to paste content
 */
async function pasteResult(): Promise<void> {
  if (!isRunningFromApp()) {
    return;
  }

  const script = `tell application "System Events" to keystroke "v" using command down`;
  
  const process = new Deno.Command("osascript", {
    args: ["-e", script],
    stdout: "piped",
    stderr: "piped"
  });
  
  await process.output();
}

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

function parseImagesMarkdown(markdownContent: string): ImageInfo[] {
  const images: ImageInfo[] = [];
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

function parseImagesFromClipboard(clipboardContent: string): ImageInfo[] {
  const trimmed = clipboardContent.trim();
  if (trimmed.startsWith('<img')) {
    return parseImages(trimmed);
  }
  return parseImagesMarkdown(trimmed);
}

/**
 * Parses a PR title and formats it with ticket identifier and optional part suffix
 * Examples:
 * - "Mb 80 group by parking lot" -> "[MB-80] Group by parking lot"
 * - "Saas 1234 feature name part 1" -> "[SAAS-1234] [PART-1] Feature name"
 * - "no ticket feature name" -> "[no-ticket] Feature name"
 * - "Noticket feature name" -> "[no-ticket] Feature name"
 * - "MB 123" -> "[MB-123]"
 */
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

/**
 * Parses HTML content and extracts image information
 */
function parseImages(htmlContent: string): ImageInfo[] {
  const imgRegex = /<img[^>]+>/gi;
  const images: ImageInfo[] = [];
  
  let match;
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const imgTag = match[0];
    
    // Extract alt attribute
    const altMatch = imgTag.match(/alt="([^"]+)"/i);
    const originalAlt = altMatch ? altMatch[1] : '';
    
    // Extract src attribute
    const srcMatch = imgTag.match(/src="([^"]+)"/i);
    const src = srcMatch ? srcMatch[1] : '';
    
    if (originalAlt && src) {
      // Parse the filename to extract structured information
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

/**
 * Groups images by category and creates table rows, preserving order
 */
function groupImagesByCategory(images: ImageInfo[]): { 
  standaloneImages: ImageInfo[];
  pairedGroups: Map<string, { before?: ImageInfo; after?: ImageInfo; order: number }>;
} {
  const standaloneImages: ImageInfo[] = [];
  const pairedGroups = new Map<string, { before?: ImageInfo; after?: ImageInfo; order: number }>();
  
  for (const image of images) {
    if (image.timing === 'standalone') {
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
function formatCategoryTitle(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates HTML table from grouped images, preserving order
 */
function generateTable(standaloneImages: ImageInfo[], pairedGroups: Map<string, { before?: ImageInfo; after?: ImageInfo; order: number }>): string {
  let tableHtml = '<details><summary>Click to expand...</summary>\n<table>\n';
  
  // Convert paired groups to array and sort by order
  const sortedPairedGroups = Array.from(pairedGroups.entries())
    .sort(([, a], [, b]) => a.order - b.order);
  
  // Standalone images are already sorted by order
  
  // First, add standalone images (max 2 per row)
  if (standaloneImages.length > 0) {
    for (let i = 0; i < standaloneImages.length; i += 2) {
      tableHtml += '  <tr>\n';
      
      // First image in the row
      const image1 = standaloneImages[i];
      const title1 = formatCategoryTitle(image1.category);
      tableHtml += `    <th>${title1}</th>\n`;
      
      // Second image in the row (if exists)
      if (i + 1 < standaloneImages.length) {
        const image2 = standaloneImages[i + 1];
        const title2 = formatCategoryTitle(image2.category);
        tableHtml += `    <th>${title2}</th>\n`;
      } else {
        tableHtml += '    <th></th>\n';
      }
      
      tableHtml += '  </tr>\n';
      
      // Add image row
      tableHtml += '  <tr>\n';
      tableHtml += `    <td><img src="${image1.src}" alt="${image1.alt}" width="400"></td>\n`;
      
      if (i + 1 < standaloneImages.length) {
        const image2 = standaloneImages[i + 1];
        tableHtml += `    <td><img src="${image2.src}" alt="${image2.alt}" width="400"></td>\n`;
      } else {
        tableHtml += '    <td></td>\n';
      }
      
      tableHtml += '  </tr>\n';
    }
  }
  
  // Then, add paired groups (before/after) in order
  for (const [category, group] of sortedPairedGroups) {
    const categoryTitle = formatCategoryTitle(category);
    
    // Add main category header row with colspan
    tableHtml += '  <tr>\n';
    tableHtml += `    <th colspan="2">${categoryTitle}</th>\n`;
    tableHtml += '  </tr>\n';
    
    // Add sub-header row for Before/After
    tableHtml += '  <tr>\n';
    tableHtml += '    <th>Before</th>\n';
    tableHtml += '    <th>After</th>\n';
    tableHtml += '  </tr>\n';
    
    // Add image row
    tableHtml += '  <tr>\n';
    
    if (group.before) {
      tableHtml += `    <td><img src="${group.before.src}" alt="${group.before.alt}" width="400"></td>\n`;
    } else {
      tableHtml += '    <td></td>\n';
    }
    
    if (group.after) {
      tableHtml += `    <td><img src="${group.after.src}" alt="${group.after.alt}" width="400"></td>\n`;
    } else {
      tableHtml += '    <td></td>\n';
    }
    
    tableHtml += '  </tr>\n';
  }
  
  tableHtml += '</table></details>';
  
  return tableHtml;
}

/**
 * Main function that orchestrates the clipboard conversion
 */
async function convertClipboard(): Promise<void> {
  try {
    await showProgress("Reading clipboard content...");
    const clipboardContent = await readClipboard();
    
    if (!clipboardContent.trim()) {
      await showDialog("Clipboard is empty. Please copy some content first.", "No Content", 'error');
      return;
    }
    
    const trimmedClipboard = clipboardContent.trim();
    const isImageSnippet = trimmedClipboard.startsWith('<img') || trimmedClipboard.startsWith('![');

    // Check if clipboard contains image snippet or plain text (PR title)
    if (!isImageSnippet) {
      // PR title mode
      await showProgress("Parsing PR title...");
      const formattedTitle = parsePRTitle(clipboardContent);
      
      if (!formattedTitle) {
        await showDialog("Could not parse PR title. Please check the format.", "Parse Error", 'error');
        return;
      }
      
      await showProgress("Writing formatted title to clipboard...");
      await writeClipboard(formattedTitle);
      
      await showDialog(`Successfully formatted PR title!\n\nResult: ${formattedTitle}`, "Success");
      
      if (isRunningFromApp()) {
        await pasteResult();
        Deno.exit(0);
      }
      return;
    }
    
    // Image table mode
    await showProgress("Parsing images...");
    const images = parseImagesFromClipboard(clipboardContent);
    
    if (images.length === 0) {
      await showDialog(
        "No valid images found in clipboard content. Make sure your clipboard starts with <img ...> tags or Markdown images like ![alt](src).",
        "No Images Found",
        'error'
      );
      return;
    }
    
    await showProgress(`Found ${images.length} images, grouping by category...`);
    const { standaloneImages, pairedGroups } = groupImagesByCategory(images);
    
    await showProgress("Generating table...");
    const tableHtml = generateTable(standaloneImages, pairedGroups);
    
    await showProgress("Writing result to clipboard...");
    await writeClipboard(tableHtml);
    
    const totalCategories = standaloneImages.length + pairedGroups.size;
    await showDialog(`Successfully converted clipboard content to table format!\nProcessed ${totalCategories} categories with ${images.length} images.`, "Success");
    
    // If running from app, we can exit cleanly
    if (isRunningFromApp()) {
      await pasteResult();
      Deno.exit(0);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await showDialog(`An error occurred: ${errorMessage}`, "Error", 'error');
    
    if (isRunningFromApp()) {
      Deno.exit(1);
    } else {
      console.error("❌ Error:", errorMessage);
      Deno.exit(1);
    }
  }
}

if (import.meta.main) {
  await convertClipboard();
}
