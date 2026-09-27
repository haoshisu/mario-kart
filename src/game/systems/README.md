# Systems boundary

Phase 2 race rules live in the framework-independent `game/core/race` modules beside the kart core. This directory remains reserved for orchestration systems only if a later phase needs them; multiplayer synchronization belongs to `game/network`, not the race rules.
