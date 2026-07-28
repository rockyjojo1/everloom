# LPC Character Sprites

This directory contains Liberated Pixel Cup (LPC) character spritesheets for Everloom.

## Structure

The character sprites are organized by layer, following the universal LPC spritesheet format:

```
char/
  body/          # Skin tone variations
    body_light.png
    body_tan.png
    body_bronze.png
    body_brown.png
    body_dark.png
    body_black.png
  hair/          # Hair style variations (8 styles)
  torso/         # Shirt/upper body colors (10 colors)
  legs/          # Pants/lower body colors (10 colors)
```

## Generation

Character sheets are generated from the **Universal LPC Spritesheet Generator**:
- **Repository**: https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator
- **Live Tool**: https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/

### To Generate Character Sheets:

1. Visit the generator at the link above
2. Select desired appearance options (skin tone, hair, clothing colors)
3. Download the PNG spritesheet for each layer
4. Place in the appropriate subdirectory (body/, hair/, torso/, legs/)

### Spritesheet Format

Each PNG is a 64×64px grid (universal LPC layout):
- **Rows 0-1**: Idle stance (16 directions)
- **Rows 8-11**: Walk cycle (up, left, down, right) with 9 frames each
- **Rows 12-15**: Attack/slash animation (6 frames)
- **Rows 4-7**: Mining/thrust animation (8 frames)

## Runtime Composition

In Phase 2, the character renderer will:
1. Load body + hair + torso + legs layers per appearance
2. Composite them into a single spritesheet (offscreen canvas)
3. Tint colors using `globalCompositeOperation: "source-atop"` if needed
4. Cache the composite per-appearance
5. Extract frame by frame for walking/action animations

## License

All generated sheets inherit CC-BY-SA 3.0 / GPL 3.0 from the LPC Generator and component artists.

See `CREDITS.md` at the repository root for full attribution.
