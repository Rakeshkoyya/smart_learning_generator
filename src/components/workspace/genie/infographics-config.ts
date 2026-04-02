// ── Infographics configuration: styles, dimensions, detail levels, prompt templates ──

export type InfographicStyle =
  | "sketch-note"
  | "professional"
  | "scientific"
  | "anime"
  | "clay"
  | "instructional-comics"
  | "bento-grid";

export type DetailLevel = "standard" | "detailed";

export interface DimensionOption {
  id: string;
  label: string;
  ratio: string;      // e.g. "1:1"
  width: number;
  height: number;
}

export interface StyleOption {
  id: InfographicStyle;
  label: string;
  description: string;
  emoji: string;
}

export const DIMENSION_OPTIONS: DimensionOption[] = [
  { id: "1:1",   label: "Square (1:1)",           ratio: "1:1",   width: 1024, height: 1024 },
  { id: "16:9",  label: "Widescreen (16:9)",      ratio: "16:9",  width: 1344, height: 768 },
  { id: "9:16",  label: "Portrait (9:16)",         ratio: "9:16",  width: 768,  height: 1344 },
  { id: "4:3",   label: "Standard (4:3)",          ratio: "4:3",   width: 1184, height: 864 },
  { id: "3:4",   label: "Standard Portrait (3:4)", ratio: "3:4",   width: 864,  height: 1184 },
  { id: "3:2",   label: "Photo (3:2)",             ratio: "3:2",   width: 1248, height: 832 },
  { id: "2:3",   label: "Photo Portrait (2:3)",    ratio: "2:3",   width: 832,  height: 1248 },
];

export const STYLE_OPTIONS: StyleOption[] = [
  {
    id: "sketch-note",
    label: "Sketch Note",
    description: "Hand-drawn sketchnote style with doodles and arrows",
    emoji: "✏️",
  },
  {
    id: "professional",
    label: "Professional",
    description: "Clean corporate infographic with charts and icons",
    emoji: "💼",
  },
  {
    id: "scientific",
    label: "Scientific",
    description: "Academic style with diagrams and data visualization",
    emoji: "🔬",
  },
  {
    id: "anime",
    label: "Anime",
    description: "Anime/manga-inspired visual storytelling",
    emoji: "🎌",
  },
  {
    id: "clay",
    label: "Clay / 3D",
    description: "Claymation-style 3D rendered infographic",
    emoji: "🎨",
  },
  {
    id: "instructional-comics",
    label: "Instructional Comics",
    description: "Comic strip panels explaining concepts step by step",
    emoji: "💬",
  },
  {
    id: "bento-grid",
    label: "Bento Grid",
    description: "Modern bento-box grid layout with organized sections",
    emoji: "🍱",
  },
];

export const DETAIL_LEVELS: { id: DetailLevel; label: string; description: string }[] = [
  { id: "standard",  label: "Standard",  description: "Key points and main topics" },
  { id: "detailed",  label: "Detailed",  description: "Comprehensive with all sub-topics" },
];

// ── Prompt templates ──

/** System prompt for Step 1: summarize all source content */
export const SUMMARY_SYSTEM_PROMPT = `You are an expert content analyst. Your job is to create a comprehensive summary that captures the COMPLETE essence of the provided source material.

REQUIREMENTS:
- Extract ALL key points, concepts, topics, and sub-topics
- Do NOT omit any significant information
- Preserve relationships between concepts
- Highlight important data, statistics, and facts
- Maintain the logical structure and flow of the original content
- Include definitions of technical terms
- Note any conclusions, recommendations, or key takeaways

Output a well-structured summary using clear headings and bullet points. The summary must be thorough enough that someone reading it would understand the full depth of the source material without needing to read the original.`;

export const SUMMARY_USER_PROMPT = `Analyze the following source content and create an exhaustive summary. Do not skip any topic or key point.

SOURCE CONTENT:
{SOURCE_TEXT}

Create the most complete summary possible.`;

/** Style-specific visual instructions for the image prompt generation */
export const STYLE_PROMPTS: Record<InfographicStyle, string> = {
  "sketch-note": `VISUAL STYLE: Sketchnote / Hand-drawn
- Use a white or cream paper background with hand-drawn elements
- Include hand-lettered titles and text in varied sizes
- Draw simple icons, doodles, and small illustrations next to each concept
- Use arrows, connecting lines, and visual flow indicators
- Add highlight boxes, banners, and speech bubbles for emphasis
- Use a limited color palette (3-4 colors max) with one accent color
- Include small human figures or faces for relatability
- Make it feel organic and personal, like notes from a brilliant lecture`,

  "professional": `VISUAL STYLE: Professional Corporate Infographic
- Clean white or light background with modern sans-serif typography
- Use a structured grid layout with clear visual hierarchy
- Include flat-design icons and pictograms for each concept
- Use data visualization elements: bar charts, pie charts, progress bars
- Apply a corporate color scheme with primary and accent colors
- Add numbered sections or timeline flows
- Include header banner with title and subtitle
- Use subtle gradients and shadows for depth
- Keep spacing generous and well-organized`,

  "scientific": `VISUAL STYLE: Scientific / Academic
- Use a clean, data-driven layout reminiscent of a research poster
- Include detailed diagrams, flowcharts, and process flows
- Use scientific visualization: graphs, scatter plots, molecular structures if relevant
- Apply a muted, professional color scheme (blues, greys, with accent colors)
- Include labeled figures and tables with captions
- Use a multi-column layout typical of academic posters
- Add references and citation-style annotations
- Include magnified detail callouts for complex concepts`,

  "anime": `VISUAL STYLE: Anime / Manga
- Use vibrant anime-style illustration with dynamic compositions
- Include chibi or stylized anime characters explaining concepts
- Use manga panel layouts with speech bubbles and thought clouds
- Apply dramatic lighting effects, speed lines, and action poses
- Use bright, saturated color palette typical of anime
- Include kawaii-style icons and decorative elements
- Add emphasis effects like sparkles, exclamation marks, and sweat drops
- Make characters interact with the information visually`,

  "clay": `VISUAL STYLE: Claymation / 3D Rendered
- Create a 3D claymation-style scene on a simple background
- Model key concepts as cute 3D clay figures and objects
- Use soft, rounded shapes with visible clay texture
- Apply warm, pastel lighting with soft shadows
- Include miniature 3D text labels floating near objects
- Create a diorama-like composition with depth
- Use playful 3D icons and symbols
- Add subtle fingerprint textures for authenticity`,

  "instructional-comics": `VISUAL STYLE: Instructional Comic Strip
- Create a multi-panel comic layout (4-8 panels)
- Include recurring character(s) as guide/narrator
- Use speech bubbles and narration boxes for text
- Draw clear, bold outlines in comic book style
- Apply flat, vibrant colors with halftone dot shading
- Each panel should explain one key concept or step
- Add "POW", "ZAP" style emphasis for important points
- Include a title panel and conclusion panel
- Use visual metaphors and analogies in illustrations`,

  "bento-grid": `VISUAL STYLE: Bento Grid Layout
- Create a modern Japanese bento-box inspired grid layout
- Use rounded rectangle sections of varying sizes
- Each grid cell contains one concept with icon and brief text
- Apply a clean, minimal aesthetic with plenty of whitespace
- Use a harmonious color palette with each section having subtle different tints
- Include small icons or illustrations in each cell
- Apply consistent padding and spacing between cells
- Use modern, clean typography
- Main title gets the largest cell, sub-topics in smaller cells
- Add subtle borders or shadows to separate sections`,
};

/** Detail level modifiers */
export const DETAIL_PROMPTS: Record<DetailLevel, string> = {
  standard: `DETAIL LEVEL: Standard
- Focus on the top-level key points and main concepts only
- Use concise text labels (3-7 words per concept)
- Include 5-8 major sections or visual groups
- Prioritize clarity and readability over completeness
- Each visual element should represent one major idea`,

  detailed: `DETAIL LEVEL: Detailed / Comprehensive
- Include ALL topics, sub-topics, and supporting details
- Use more text content in each section with brief explanations
- Include 8-15 sections or visual groups with sub-elements
- Show relationships and connections between concepts
- Add secondary details, examples, and data points
- Include a legend or key if many elements are used
- Layer information with primary, secondary, and tertiary hierarchy`,
};

/** System prompt for Step 2: generate image prompt from summary */
export const IMAGE_PROMPT_SYSTEM = `You are an expert visual designer and prompt engineer specializing in creating infographic images. You think like a visual storyteller who can translate complex information into compelling visual compositions.

Your task is to create an extremely detailed image generation prompt that will produce a single infographic image summarizing the given content.

CRITICAL RULES:
1. Describe EVERY visual element in detail: what objects, characters, icons, shapes, and decorations should appear
2. Specify EXACT positions: "top-left corner", "center of the image", "bottom-right section"
3. Describe text placement: what text appears, where, what size relative to other elements
4. Define the color palette explicitly
5. Describe the overall composition and visual flow (how the eye moves through the image)
6. Include background details
7. Specify any visual connections between elements (arrows, lines, flow indicators)
8. The prompt must ensure that EVERY key topic from the summary is visually represented
9. Think about visual hierarchy: what should stand out most, what is secondary
10. The image must be self-contained — a viewer should understand the full content from the image alone`;

export const IMAGE_PROMPT_USER = `Based on the following content summary, create a highly detailed image generation prompt for an infographic.

CONTENT SUMMARY:
{SUMMARY}

{STYLE_INSTRUCTIONS}

{DETAIL_INSTRUCTIONS}

IMAGE DIMENSIONS: {WIDTH}x{HEIGHT} pixels ({RATIO} aspect ratio)

Generate a single, comprehensive image prompt. The prompt should be detailed enough that an AI image generator can produce an infographic where every key topic is visually represented. Include specific details about:
- What objects, characters, or icons to draw and where
- What text/labels to place and where
- The color scheme and visual style
- The layout and composition
- How different concepts are visually connected

Output ONLY the image generation prompt, nothing else. Do not wrap it in quotes or add explanations.`;
