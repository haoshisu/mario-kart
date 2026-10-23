# Taiwan city street kit

Original Blender dressing for the existing Taiwan architecture modules. `street`
fits arcade/stucco, `tea` fits side tea houses, and `harbor` fits side warehouses.
Keep portals and stacked landmark tea houses out of this placement list.

Rebuild with Blender 4.5:

```sh
blender --background --threads 2 --python scripts/build-taiwan-city.py
blender --background --threads 2 --python scripts/build-taiwan-city.py -- --low
blender --background --threads 2 --python scripts/render-taiwan-city.py
```

Run from the repository root. Letter outlines are generated with the macOS
STHeiti Light system font at `/System/Library/Fonts/STHeiti Light.ttc`; the font
file is not redistributed. The script requires that font at build time. All text
is converted to meshes before export. No browser font or image downloads occur.

The `.blend` files use metres and Z-up; the GLBs in `public/models` export Y-up.
Two shared vertex-color materials encode paint and sign/lantern light. There are
no runtime point lights. The low mesh uses flat letters, reduced lantern/tank
segments, and omits balcony rails, AC units, flower pots and small furniture.
The JSON files record triangle counts per mesh. Runtime instances the kit with
78 m standard / 28 m low visibility; overview omits the small detail layer.

`doc/images/taiwan-city/blender-streets.png` is a studio render of the assembled
Blender modules, not a gameplay screenshot. Other images in that directory are
captured from the actual browser game.
