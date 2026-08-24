import type { RankedPlayer } from "./types";

/**
 * Turns a player's already-computed scores into a short, plain-language
 * explanation — no new analysis happens here, it's a deterministic template
 * over real numbers the scoring engine already produced. This is NOT the
 * AI layer: nothing here is generated text from a model, and there is
 * nothing here that isn't traceable back to a category score.
 *
 * CONFIDENCE-GATED LANGUAGE (see docs/PERFORMANCE_INTELLIGENCE_AUDIT.md §3.1):
 * a category score is calculated identically regardless of sample size —
 * the number itself is never softened. What changes at "Limited" confidence
 * (fewer than 3 matches, see classifySampleConfidence) is the CLAIM we make
 * about it: "Elite attacking threat" implies an established characteristic;
 * a single 77-minute match hasn't earned that claim yet, however high the
 * percentile. At Limited confidence this module reports the same
 * categories with early-signal language instead ("Early attacking
 * impact... not yet proven") — never suppressed outright, since an empty
 * "Key strengths" section for most of the early season would be its own
 * kind of unhelpful. Once a player reaches "Developing" confidence
 * (3+ matches) or "Established" (8+), normal strength language returns.
 */

export interface Strength {
  icon: string;
  title: string;
  description: string;
}

export interface PlayerExplanation {
  headline: string;
  strengths: Strength[];
}

function tierWord(score: number): string {
  if (score >= 8.5) return "Elite";
  if (score >= 7.0) return "Excellent";
  if (score >= 5.5) return "Strong";
  if (score >= 4.0) return "Solid";
  return "Developing";
}

const CATEGORY_STRENGTH: Record<string, { icon: string; title: string; describe: (tier: string) => string }> = {
  attack: { icon: "⚡", title: "Attacking threat", describe: (t) => `${t} threat in front of goal this season.` },
  creation: { icon: "🎯", title: "Chance creation", describe: (t) => `${t} at creating chances for teammates.` },
  defence: { icon: "🛡️", title: "Defensive work", describe: (t) => `${t} defensive contribution for the position.` },
  impact: { icon: "💥", title: "Match impact", describe: (t) => `${t} overall influence on matches.` },
  form: { icon: "📈", title: "Recent form", describe: (t) => `${t} performances in recent matches.` },
};

/** The softer, Limited-confidence phrasing — "early signal", not "proven trait". */
const EARLY_TITLE: Record<string, string> = {
  attack: "Early attacking impact",
  creation: "Early creative impact",
  defence: "Early defensive impact",
  impact: "Early match impact",
  form: "Early form signal",
};

const STRENGTH_MIN_SCORE = 4.0; // "Solid" or better — see qualityLabelFor
const CATEGORY_LABEL: Record<string, string> = {
  attack: "attacking output",
  creation: "chance creation",
  defence: "defensive work",
  impact: "match impact",
  form: "recent form",
};

export function explainPlayer(player: RankedPlayer): PlayerExplanation {
  const candidates = (["attack", "creation", "defence", "impact", "form"] as const)
    .map((key) => ({ key, score: player.scores[key] ?? 0 }))
    .filter((c) => c.score >= STRENGTH_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const overall = player.scores.overall ?? 0;
  const qualityLabel = player.qualityLabel.toLowerCase();
  const isLimited = player.sample.confidence === "low";
  const matchWord = `${player.sample.matches} match${player.sample.matches === 1 ? "" : "es"}`;

  if (candidates.length === 0) {
    return {
      headline: `Still building a track record this season${
        player.sample.matches <= 2 ? " — only a handful of matches so far." : "."
      }`,
      strengths: [],
    };
  }

  const top = candidates[0];
  const headline = isLimited
    ? `Early days — rated ${qualityLabel} so far, based on just ${matchWord}.`
    : `Rated ${qualityLabel} overall (${overall.toFixed(1)}), driven mainly by ${CATEGORY_LABEL[top.key]}.`;

  const strengths = candidates.slice(0, 4).map(({ key, score }) => {
    const def = CATEGORY_STRENGTH[key];
    if (isLimited) {
      return {
        icon: def.icon,
        title: EARLY_TITLE[key],
        description: `Based on ${matchWord} so far — an early signal, not yet a proven strength.`,
      };
    }
    return { icon: def.icon, title: def.title, description: def.describe(tierWord(score)) };
  });

  return { headline, strengths };
}
