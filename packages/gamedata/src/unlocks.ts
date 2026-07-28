/**
 * Unlock requirements: maps nodes/recipes to level thresholds
 * Used for "Next: X at Level Y" teasers
 */

export interface NodeUnlock {
  nodeId: string;
  skill: string;
  requiredLevel: number;
  name: string;
  teaserText: string; // e.g., "Oak Trees"
}

export interface RecipeUnlock {
  recipeId: string;
  skill: string;
  requiredLevel: number;
  name: string;
  teaserText: string;
}

export const NODE_UNLOCKS: NodeUnlock[] = [
  { nodeId: 'bramblewood_oak', skill: 'woodcutting', requiredLevel: 15, name: 'Oak Tree', teaserText: 'Oak Trees' },
  { nodeId: 'bramblewood_iron_vein', skill: 'mining', requiredLevel: 15, name: 'Iron Vein', teaserText: 'Iron Ore' },
  { nodeId: 'bramblewood_perch_pool', skill: 'fishing', requiredLevel: 15, name: 'Perch Hollow', teaserText: 'Perch' },
  { nodeId: 'ashen_delve_coal_vein', skill: 'mining', requiredLevel: 30, name: 'Coal Seam', teaserText: 'Coal' },
  { nodeId: 'ashen_delve_iron_vein', skill: 'mining', requiredLevel: 20, name: 'Iron Vein (Deep)', teaserText: 'Deep Iron' },
  { nodeId: 'ashen_delve_cave_eel_pool', skill: 'fishing', requiredLevel: 30, name: 'Cave Eel Grotto', teaserText: 'Cave Eels' },
];

export const RECIPE_UNLOCKS: RecipeUnlock[] = [
  { recipeId: 'craft_oak_board', skill: 'crafting', requiredLevel: 10, name: 'Oak Board', teaserText: 'Oak Boards' },
  { recipeId: 'fletch_oak_shaft', skill: 'fletching', requiredLevel: 10, name: 'Oak Shaft', teaserText: 'Oak Shafts' },
  { recipeId: 'smith_iron_pickaxe_head', skill: 'smithing', requiredLevel: 20, name: 'Iron Pickaxe Head', teaserText: 'Iron Tools' },
  { recipeId: 'cook_trout', skill: 'cooking', requiredLevel: 10, name: 'Cooked Trout', teaserText: 'Trout' },
  { recipeId: 'assemble_iron_pickaxe', skill: 'crafting', requiredLevel: 20, name: 'Iron Pickaxe', teaserText: 'Iron Pickaxe' },
];

export function getNextUnlock(skill: string, currentLevel: number): NodeUnlock | RecipeUnlock | null {
  // Get next node unlock
  const nextNode = NODE_UNLOCKS.find(
    (n) => n.skill === skill && n.requiredLevel > currentLevel
  );

  // Get next recipe unlock
  const nextRecipe = RECIPE_UNLOCKS.find(
    (r) => r.skill === skill && r.requiredLevel > currentLevel
  );

  // Return whichever is closest
  if (!nextNode) return nextRecipe || null;
  if (!nextRecipe) return nextNode;

  return nextNode.requiredLevel < nextRecipe.requiredLevel ? nextNode : nextRecipe;
}
