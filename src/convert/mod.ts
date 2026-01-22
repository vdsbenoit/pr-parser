import { readClipboard, writeClipboard } from "../clipboard/mod.ts";
import { groupImagesByCategory, parseImagesFromClipboard } from "../images/mod.ts";
import { parsePRTitle } from "../pr-title/mod.ts";
import { generateTable } from "../table/mod.ts";
import {
  isRunningFromApp,
  pasteResult,
  showDialog,
  showProgress,
} from "../system/mod.ts";

/**
 * Main function that orchestrates the clipboard conversion
 */
export async function convertClipboard(): Promise<void> {
  try {
    await showProgress("Reading clipboard content...");
    const clipboardContent = await readClipboard();

    if (!clipboardContent.trim()) {
      await showDialog(
        "Clipboard is empty. Please copy some content first.",
        "No Content",
        "error",
      );
      return;
    }

    const trimmedClipboard = clipboardContent.trim();
    const isImageSnippet = trimmedClipboard.startsWith("<img") ||
      trimmedClipboard.startsWith("![");

    // Check if clipboard contains image snippet or plain text (PR title)
    if (!isImageSnippet) {
      // PR title mode
      await showProgress("Parsing PR title...");
      const formattedTitle = parsePRTitle(clipboardContent);

      if (!formattedTitle) {
        await showDialog(
          "Could not parse PR title. Please check the format.",
          "Parse Error",
          "error",
        );
        return;
      }

      await showProgress("Writing formatted title to clipboard...");
      await writeClipboard(formattedTitle);

      await showDialog(
        `Successfully formatted PR title!\n\nResult: ${formattedTitle}`,
        "Success",
      );

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
        "error",
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
    await showDialog(
      `Successfully converted clipboard content to table format!\nProcessed ${totalCategories} categories with ${images.length} images.`,
      "Success",
    );

    // If running from app, we can exit cleanly
    if (isRunningFromApp()) {
      await pasteResult();
      Deno.exit(0);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await showDialog(`An error occurred: ${errorMessage}`, "Error", "error");

    if (isRunningFromApp()) {
      Deno.exit(1);
    } else {
      console.error("❌ Error:", errorMessage);
      Deno.exit(1);
    }
  }
}
