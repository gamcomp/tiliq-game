# Tiliq — Sky Harbor web polish

Scope: local browser review, 2026-09-09. No deployment or store submission until user approval.

Existing game: an 8×8 block placement puzzle, with line clears, timed combos, hammers and color blast. Audience: casual puzzle players. Runtime: Canvas 2D + DOM + Web Audio, packaged with Capacitor for Android/iOS.

This iteration improves tactile feedback, enamel block materials, placement readability and audio mixing. Game rules, economy, branding and reference screen hierarchy stay intact. Reference/home-reference.png and reference/game-reference.png are the visual specifications.

Review: a localhost-only preview with isolated browser storage, no Firebase initialization, no remote connections, and deterministic gameplay scenarios. Compare the baseline and improved version with the same board. Physical mobile performance and native builds remain unverified until a later device test.
