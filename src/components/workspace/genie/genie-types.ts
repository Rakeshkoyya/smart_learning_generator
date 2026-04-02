export type GenieFeature =
  | "mindmap"
  | "video"
  | "audio"
  | "slide-deck"
  | "flashcards"
  | "infographics"
  | "quiz";

export interface GenieFeatureCard {
  id: GenieFeature;
  label: string;
  description: string;
  icon: string; // lucide icon name reference
  color: string; // tailwind bg color class
}

export const GENIE_FEATURES: GenieFeatureCard[] = [
  {
    id: "mindmap",
    label: "Mind Map",
    description: "Generate visual mind maps from your content",
    icon: "GitBranch",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "video",
    label: "Video",
    description: "Generate video content from sources",
    icon: "Video",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    id: "audio",
    label: "Audio",
    description: "Generate audio narrations",
    icon: "Headphones",
    color: "bg-green-500/10 text-green-600",
  },
  {
    id: "slide-deck",
    label: "Slide Deck",
    description: "Create PPT-style image slides",
    icon: "Presentation",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "One-word Q&A flashcards",
    icon: "Layers",
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    id: "infographics",
    label: "Infographics",
    description: "One-image content summary",
    icon: "BarChart3",
    color: "bg-teal-500/10 text-teal-600",
  },
  {
    id: "quiz",
    label: "Quiz",
    description: "Generate quizzes from your content",
    icon: "HelpCircle",
    color: "bg-amber-500/10 text-amber-600",
  },
];
