import type { ImageInfo } from "../types/mod.ts";
import { formatCategoryTitle } from "../images/mod.ts";

/**
 * Generates HTML table from grouped images, preserving order
 */
export function generateTable(
  standaloneImages: ImageInfo[],
  pairedGroups: Map<
    string,
    { before?: ImageInfo; after?: ImageInfo; order: number }
  >,
): string {
  let tableHtml =
    "<details><summary>Click to expand...</summary>\n<table>\n";

  // Convert paired groups to array and sort by order
  const sortedPairedGroups = Array.from(pairedGroups.entries())
    .sort(([, a], [, b]) => a.order - b.order);

  // Standalone images are already sorted by order

  // First, add standalone images (max 2 per row)
  if (standaloneImages.length > 0) {
    for (let i = 0; i < standaloneImages.length; i += 2) {
      tableHtml += "  <tr>\n";

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
        tableHtml += "    <th></th>\n";
      }

      tableHtml += "  </tr>\n";

      // Add image row
      tableHtml += "  <tr>\n";
      tableHtml +=
        `    <td><img src="${image1.src}" alt="${image1.alt}" width="400"></td>\n`;

      if (i + 1 < standaloneImages.length) {
        const image2 = standaloneImages[i + 1];
        tableHtml +=
          `    <td><img src="${image2.src}" alt="${image2.alt}" width="400"></td>\n`;
      } else {
        tableHtml += "    <td></td>\n";
      }

      tableHtml += "  </tr>\n";
    }
  }

  // Then, add paired groups (before/after) in order
  for (const [category, group] of sortedPairedGroups) {
    const categoryTitle = formatCategoryTitle(category);

    // Add main category header row with colspan
    tableHtml += "  <tr>\n";
    tableHtml += `    <th colspan="2">${categoryTitle}</th>\n`;
    tableHtml += "  </tr>\n";

    // Add sub-header row for Before/After
    tableHtml += "  <tr>\n";
    tableHtml += "    <th>Before</th>\n";
    tableHtml += "    <th>After</th>\n";
    tableHtml += "  </tr>\n";

    // Add image row
    tableHtml += "  <tr>\n";

    if (group.before) {
      tableHtml +=
        `    <td><img src="${group.before.src}" alt="${group.before.alt}" width="400"></td>\n`;
    } else {
      tableHtml += "    <td></td>\n";
    }

    if (group.after) {
      tableHtml +=
        `    <td><img src="${group.after.src}" alt="${group.after.alt}" width="400"></td>\n`;
    } else {
      tableHtml += "    <td></td>\n";
    }

    tableHtml += "  </tr>\n";
  }

  tableHtml += "</table></details>";

  return tableHtml;
}
