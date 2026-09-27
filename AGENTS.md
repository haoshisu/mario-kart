# AGENTS.md

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project source of truth

- Before implementing or changing features, read `tech-doc/document.md`.
- `tech-doc/document.md` is the source of truth for product goals, gameplay rules, architecture, development phases, MVP scope, networking, assets, and performance requirements.
- Do not duplicate the technical document in this file. Update the technical document when an approved product or architecture decision changes.
- For installed packages, scripts, and framework versions, `package.json` and the existing repository are authoritative.
- The current project uses Next.js App Router. Do not add Vite or migrate bundlers unless explicitly requested.

## Scope and product guardrails

- Implement only the feature or development phase requested by the user.
- Do not pre-build later phases merely to “prepare” for them; create clean extension boundaries instead.
- Do not add services, dependencies, routes, abstractions, or placeholder systems without a current requirement.
- Preserve existing user changes and avoid unrelated refactors.
- All names, characters, vehicles, tracks, models, textures, audio, and branding must be original or properly licensed. Never add Nintendo or Mario assets.

## Architecture boundaries

- Keep Next.js route files focused on routing, page composition, and server/client data boundaries.
- `src/game/Game.tsx` owns the R3F Canvas and top-level scene composition; it must not become a monolithic gameplay module.
- Keep visual scene components in `src/game/components` and Rapier bodies, colliders, and physics integration in `src/game/physics`.
- Place gameplay rules in `src/game/systems`, input adapters in `src/game/input`, networking in `src/game/network`, and domain models in `src/game/entities` when those modules are introduced by the active phase.
- Keep high-frequency game and physics state out of React state where possible.
- Input devices produce normalized player intent; controllers must not be authoritative for kart position or rotation.
- Share cross-boundary types from one source instead of redefining incompatible client, controller, and server shapes.

## Coding rules

- Maintain strict TypeScript. Do not hide errors with `any`, unnecessary assertions, disabled lint rules, or ignored failures.
- Use Server Components by default. Add `"use client"` only at the smallest boundary that requires browser APIs, R3F, events, or hooks.
- Keep modules small and single-purpose; extract pure logic from rendering and integration code.
- Centralize gameplay tuning values instead of scattering magic numbers through JSX.
- Frame-based movement and smoothing must use delta time and handle unusually large frame gaps safely.
- Clean up event listeners, timers, sockets, sensors, and other subscriptions.
- Avoid per-frame allocations and React rerenders inside `useFrame` unless necessary.
- Add a runtime dependency only when the existing stack cannot reasonably satisfy the requirement.
- Comments should explain intent, constraints, and non-obvious tradeoffs rather than narrating the code.

## Working process

- Inspect the relevant code and current working-tree changes before editing.
- Make the smallest coherent change that completes the request.
- Follow existing naming, import aliases, directory structure, and styling conventions.
- If implementation reveals a material conflict with `tech-doc/document.md`, stop and surface the conflict instead of silently changing product behavior.
- Update documentation only when behavior, commands, architecture, or an approved decision actually changes.

## Verification

Run the checks appropriate to the change. Before completing implementation work, the default baseline is:

```bash
npm run check
npm run build
```

- Verify 3D rendering, physics, input, animation, responsive UI, and browser-specific behavior in an actual browser when affected.
- Test pure gameplay rules proportionally to their risk. Do not introduce a large test framework solely for a trivial change without discussing the tradeoff.
- Do not claim completion while relevant lint, type, build, test, runtime, or browser errors remain unexplained.
- Report what changed, what was verified, and any known limitation. Clearly state what remains outside the requested scope.
