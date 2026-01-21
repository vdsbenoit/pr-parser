import { assertEquals } from "@std/assert";
import {
  formatCategoryTitle,
  parseFilename,
  parseImages,
  parseImagesFromClipboard,
  parseImagesMarkdown,
  parsePRTitle,
} from "./main.ts";

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

Deno.test("parsePRTitle - slash-separated slug format", () => {
  const result = parsePRTitle("MB-95-preferred-times/remove-minimum-constraint-on-start-date");
  assertEquals(result, "[MB-95] Remove minimum constraint on start date");
});

Deno.test("parsePRTitle - hyphen-only slug format", () => {
  const result = parsePRTitle("MB-95-remove-minimum-constraint-on-start-date");
  assertEquals(result, "[MB-95] Remove minimum constraint on start date");
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

Deno.test("parseFilename - handles various filename formats", () => {
  const result1 = parseFilename("1. Feature_1_before");
  assertEquals(result1.order, 1);
  assertEquals(result1.timing, "before");
  assertEquals(result1.formattedAlt, "Feature 1");

  const result2 = parseFilename("2.Feature 25_before");
  assertEquals(result2.order, 2);
  assertEquals(result2.timing, "before");
  assertEquals(result2.formattedAlt, "Feature 25");

  const result3 = parseFilename("3 Feature 32");
  assertEquals(result3.order, 3);
  assertEquals(result3.timing, "standalone");
  assertEquals(result3.formattedAlt, "Feature 32");

  const result4 = parseFilename("4feature54_after");
  assertEquals(result4.order, 4);
  assertEquals(result4.timing, "after");
  assertEquals(result4.formattedAlt, "feature54");
});

Deno.test("parseImages should extract image information correctly with number prefixes", () => {
  const htmlInput = `
    <img width="1170" height="2532" alt="1. Feature_1_before" src="https://github.com/user-attachments/assets/1.jpg" />
    <img width="1170" height="2532" alt="2.Feature 25_before" src="https://github.com/user-attachments/assets/2.jpg" />
    <img width="1170" height="2532" alt="3 Feature 32" src="https://github.com/user-attachments/assets/3.jpg" />
    <img width="1170" height="2532" alt="4feature54_after" src="https://github.com/user-attachments/assets/4.jpg" />
  `;

  const images = parseImages(htmlInput);

  assertEquals(images.length, 4);

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
