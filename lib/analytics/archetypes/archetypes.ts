import type { PositionCode } from "@/lib/competitions/premier-league";
import type { RankedPlayer, SampleConfidence } from "@/lib/analytics/scoring/types";
import { confidenceLabel, type ConfidenceLabel } from "@/lib/analytics/intelligence/types";

/**
 * PLAYER ARCHETYPES — v0
 * =======================
 * An archetype describes the SHAPE of a player's statistical profile —
 * which parts of the game they contribute to most — never a quality
 * ranking. "Creative Hub" does not mean "better than Goal Threat"; it means
 * this player's Attack/Creation/Defence balance most resembles that shape.
 * See docs/PROJECT_PROPOSAL.md-style reasoning: this is descriptive, not
 * evaluative.
 *
 * WHY ONLY THREE SHAPE DIMENSIONS (Attack, Creation, Defence): those are
 * the only category scores that vary in a position-relevant way (Impact is
 * closer to "how involved were they overall" than "what kind of player are
 * they", so it's surfaced as a secondary signal, never a naming driver —
 * see `dimensions` below, which still carries it for future similarity
 * work). Progression is excluded entirely — not available from any
 * confirmed free source (docs/DATA_SOURCES.md) — using it would be
 * claiming ball-progression data this app does not have.
 *
 * WHY NO FLANK-SPECIFIC LABELS ("Attacking Full-Back", "Defensive
 * Full-Back"): `PositionCode` has exactly four values (GKP/DEF/MID/FWD) —
 * there is no centre-back/full-back distinction anywhere in the data
 * (confirmed: `prisma/schema.prisma`'s `Player.position` and
 * `lib/competitions/premier-league.ts`'s `PositionCode` both stop at the
 * same four broad groups the provider gives us). Naming a defender's
 * archetype "Full-Back" would assert a sub-position we cannot verify —
 * exactly the kind of "pretending we have tactical data we don't possess"
 * Archetype Principle #4 rules out. Defender archetypes are named without
 * reference to flank position instead.
 *
 * WHY GOALKEEPERS GET NO SHAPE ARCHETYPE: Attack/Creation percentiles are
 * computed league-wide across every outfield player — a goalkeeper's
 * near-zero per-90 goals/assists rate doesn't mean "weak in these areas",
 * it means the metric doesn't apply to the position at all. Forcing a
 * three-dimension shape onto a position where two of the three dimensions
 * are structurally meaningless would manufacture false precision.
 * Goalkeepers get a single binary read on shot-stopping instead (from
 * Defence, which for GKP already reads saves + clean sheets — see
 * `defenceMetricsForPosition` in provisional.ts).
 *
 * CONFIDENCE: reuses the existing SampleConfidence/ConfidenceLabel system
 * unchanged (see lib/analytics/intelligence/types.ts) — no new confidence
 * model. An archetype is still surfaced at Limited confidence (unlike
 * `detectStrengths`, which suppresses outright) because "no profile at all"
 * is less useful here than a clearly-flagged provisional one — the
 * qualifier text carries the honesty instead of the presence/absence of
 * the whole feature.
 */

const ELEVATED = 5.5; // matches STRENGTH_MIN in intelligence/strengths.ts
const LOW = 4.0; // matches DEVELOPMENT_MAX in intelligence/strengths.ts

export interface ArchetypeDimensions {
  attack: number;
  creation: number;
  defence: number;
  impact: number;
}

export interface PlayerArchetype {
  /** Stable key for future discovery/similarity grouping. Null when no shape clears any threshold. */
  key: string | null;
  label: string;
  description: string;
  confidence: ConfidenceLabel;
  /** "Early profile" | "Emerging profile" | null (Established — no qualifier needed). */
  qualifier: string | null;
  /** The raw 0–10 category scores this archetype was read from — the vector a future similarity/discovery feature would compare across players. */
  dimensions: ArchetypeDimensions;
}

function qualifierFor(confidence: SampleConfidence): string | null {
  if (confidence === "low") return "Early profile";
  if (confidence === "moderate") return "Emerging profile";
  return null;
}

function noProfile(dimensions: ArchetypeDimensions, confidence: SampleConfidence): PlayerArchetype {
  return {
    key: null,
    label: "Profile still taking shape",
    description: "Nothing stands out clearly yet across attack, creation or defence — check back after a few more matches.",
    confidence: confidenceLabel(confidence),
    qualifier: qualifierFor(confidence),
    dimensions,
  };
}

function shapeFor(position: PositionCode, d: ArchetypeDimensions): { key: string; label: string; description: string } | null {
  const { attack, creation, defence } = d;

  if (position === "GKP") {
    if (defence >= ELEVATED) {
      return { key: "shot_stopper", label: "Shot-Stopper", description: "Strong on saves and clean sheets relative to other goalkeepers this season." };
    }
    return null;
  }

  if (position === "DEF") {
    const going_forward = (attack + creation) / 2;
    if (defence >= ELEVATED && going_forward < LOW) {
      return { key: "defensive_anchor", label: "Defensive Anchor", description: "Profile built almost entirely around defensive work, with little involvement further forward." };
    }
    if (going_forward >= ELEVATED && defence >= LOW) {
      return { key: "attacking_defender", label: "Attacking Defender", description: "A defender who gets involved in attack and chance creation more than most, without giving up defensive output." };
    }
    if (defence >= LOW && going_forward >= LOW) {
      return { key: "all_round_defender", label: "All-Round Defender", description: "A reasonably even split between defensive duties and contributing going forward." };
    }
    return null;
  }

  if (position === "MID") {
    if (creation >= ELEVATED && creation > attack && creation > defence) {
      return { key: "creative_hub", label: "Creative Hub", description: "Chance creation is clearly this player's standout contribution — the main source of their value." };
    }
    if (attack >= ELEVATED && defence >= ELEVATED) {
      return { key: "box_to_box", label: "Box-to-Box", description: "Strong at both ends — genuine attacking threat combined with real defensive work." };
    }
    if (attack >= ELEVATED && attack > creation && attack > defence) {
      return { key: "goal_threat", label: "Goal Threat", description: "Attacking output is this player's standout contribution from midfield." };
    }
    if (defence >= ELEVATED && defence > attack && defence > creation) {
      return { key: "ball_winning_midfielder", label: "Ball-Winning Midfielder", description: "Defensive actions — tackles, interceptions and recoveries — are clearly this player's biggest contribution." };
    }
    if (attack >= LOW && creation >= LOW && defence >= LOW) {
      return { key: "all_round_midfielder", label: "All-Round Midfielder", description: "A fairly even contribution across attack, creation and defensive work — no single standout area yet." };
    }
    return null;
  }

  // FWD
  if (attack >= ELEVATED && creation >= ELEVATED) {
    return { key: "complete_forward", label: "Complete Forward", description: "Threatens goal AND creates for others — a genuinely two-way attacking profile." };
  }
  if (creation >= ELEVATED && creation > attack) {
    return { key: "creative_forward", label: "Creative Forward", description: "Creates more than they finish — more provider than pure goalscorer right now." };
  }
  if (attack >= ELEVATED) {
    return { key: "goal_threat", label: "Goal Threat", description: "Finishing is clearly this player's standout contribution." };
  }
  if (defence >= ELEVATED) {
    return {
      key: "pressing_forward",
      label: "Pressing Forward",
      description: "Notably high defensive activity (tackles, interceptions, recoveries) for a forward — a reasonable proxy for work-rate, not a literal pressing count.",
    };
  }
  return null;
}

export function classifyArchetype(player: RankedPlayer): PlayerArchetype {
  const dimensions: ArchetypeDimensions = {
    attack: player.scores.attack ?? 0,
    creation: player.scores.creation ?? 0,
    defence: player.scores.defence ?? 0,
    impact: player.scores.impact ?? 0,
  };

  const shape = shapeFor(player.position, dimensions);
  if (!shape) return noProfile(dimensions, player.sample.confidence);

  return {
    key: shape.key,
    label: shape.label,
    description: shape.description,
    confidence: confidenceLabel(player.sample.confidence),
    qualifier: qualifierFor(player.sample.confidence),
    dimensions,
  };
}
