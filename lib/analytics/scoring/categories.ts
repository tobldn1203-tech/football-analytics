import type { CategoryDefinition } from "./types";

/**
 * Plain-language definitions shown to every user, regardless of depth level.
 * `description` is the one-line explanation shown under the tabs — football
 * language, not statistical language.
 */
export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: "overall",
    label: "Performance",
    description: "The league's most complete performers, all-round.",
    available: true,
  },
  {
    key: "form",
    label: "In Form",
    description: "Players performing exceptionally right now.",
    available: true,
  },
  {
    key: "attack",
    label: "Attack",
    description: "The league's strongest attacking threats.",
    available: true,
  },
  {
    key: "creation",
    label: "Creators",
    description: "Players generating the greatest creative impact.",
    available: true,
  },
  {
    key: "progression",
    label: "Progression",
    description: "Moving the ball forward into dangerous areas.",
    available: false,
    unavailableReason:
      "Requires ball-progression data (progressive passes/carries) not yet available from a confirmed free source.",
  },
  {
    key: "defence",
    label: "Defence",
    description: "The league's strongest defensive performers.",
    available: true,
  },
  {
    key: "impact",
    label: "Impact",
    description: "Players whose performances are shaping matches.",
    available: true,
  },
];
