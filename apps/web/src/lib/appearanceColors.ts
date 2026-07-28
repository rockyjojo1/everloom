/**
 * Appearance color palettes matching CharacterCreate
 * Maps appearance indices to hex colors
 */

export const SKIN_TONES   = ["#FDBCB4","#F0A882","#D4845A","#B86035","#8B4215","#5C2A0A"];
export const HAIR_COLORS  = ["#3C2514","#6B4226","#9B6633","#D9A441","#E8DCC4","#A63A32","#C0C0C0","#E8E8E8","#3C5A73","#5E7350"];
export const TORSO_COLORS = ["#3C5A73","#A63A32","#5E7350","#4A3728","#D9A441","#7D3C98","#2C3E50","#C0392B","#1E8449","#1E2430"];
export const LEGS_COLORS  = ["#4A3728","#2C3E50","#1A5276","#A63A32","#5E7350","#7D3C98","#6B4226","#E8DCC4","#1E2430","#3C5A73"];

export interface AppearanceColors {
  skin: string;
  hair: string;
  torso: string;
  legs: string;
}

/**
 * Convert CharacterAppearance indices to color hex strings
 */
export function appearanceToColors(appearance: {
  skinTone: number;
  hairColor: number;
  torsoColor: number;
  legsColor: number;
} | undefined): AppearanceColors {
  if (!appearance) {
    return {
      skin: SKIN_TONES[0]!,
      hair: HAIR_COLORS[0]!,
      torso: TORSO_COLORS[0]!,
      legs: LEGS_COLORS[0]!,
    };
  }

  return {
    skin: SKIN_TONES[appearance.skinTone] || SKIN_TONES[0]!,
    hair: HAIR_COLORS[appearance.hairColor] || HAIR_COLORS[0]!,
    torso: TORSO_COLORS[appearance.torsoColor] || TORSO_COLORS[0]!,
    legs: LEGS_COLORS[appearance.legsColor] || LEGS_COLORS[0]!,
  };
}
