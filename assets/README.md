# Game Assets

This directory contains visual assets to improve game visuals. All assets are vector-first (SVG) for easy scaling and can be exported to raster if needed.

- ui/icons: Common UI icons (24x24 viewBox)
- ui/buttons: 9-slice and background panels for buttons
- sprites/common: Reusable in-game sprites (coins, gems, powerups)
- tiles: Tileable terrain (32x32 viewBox)
- particles/textures: Particle source textures
- color-palettes: Game color palettes and swatches
- styleguide: Visual guidelines (colors, typography, elevation)
- fonts: Font recommendations and integration notes
- licensing: License and attribution notes

Import tips:
- Unity: Import SVGs via Vector Graphics package or pre-export to PNG at target resolution. Set Sprite (2D and UI), Pixels Per Unit to match your world scale.
- Godot: Import SVGs directly in 4.x. For 3.x, export PNGs. For 9-slice, set Region and Stretch Mode.
- Unreal: Prefer PNG export; keep power-of-two sizes for UI atlases.

9-slice usage:
- Use `ui/buttons/button-panel-9slice.svg` as a base. Slice guides align to 12px inside edges for scalable corners.

Export guidance:
- UI icons: 24, 32, 48 px
- Tiles: 32, 64 px
- Sprites: 128, 256 px
- Particles: 64, 128 px

See `styleguide/visual-style.md` and `color-palettes/palette.json`.