# Playable chibi crew

Original Dodo, Lumi, Lili and Bibo drivers on the approved Kestrel kart.
Each character has standard and low geometry variants, a seated driving pose,
and two rigid-arm Victory animation clips. The separate wheel remains
`art-source/kestrel-wheel-v1.blend` / `public/models/kestrel-wheel-v1.glb`.

Rebuild with Blender 4.5 LTS:

```sh
blender --background --python scripts/build-chibi-karts.py
blender --background --python scripts/render-chibi-karts.py
```

Inputs are the retained `art-source/kestrel-study/kestrel-clay.blend` and
`art-source/dodo-racer-q-v2/dodo-racer-q-v2.blend`. This directory contains
editable Blender scenes and uncompressed reference GLBs. Compressed runtime
models go to `public/models/`; actual mesh portraits go to `public/characters/`.
`metrics.json` records runtime geometry, material count and compressed bytes.

See `tech-doc/chibi-crew.md` for selection, synchronization and verification.
All characters and geometry are project originals; no external character assets.
