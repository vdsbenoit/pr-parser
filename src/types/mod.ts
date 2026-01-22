export interface ImageInfo {
  alt: string;
  src: string;
  category: string;
  timing: "before" | "after" | "standalone";
  order: number; // For preserving custom ordering
}
