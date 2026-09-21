# Hammer targeting layout — 2026-09-21 / 1.3.103

The target bar was anchored 61 px above the board bottom, intentionally covering its last rows. It now sits 20 px below the board, in the inactive tray area. Tray drawing pauses only during hammer targeting and resumes on cancel/strike; board coordinates remain stable when toggling targeting. Cancel/confirm controls have 44 px minimum touch targets.

Canvas sizing now accounts for safe-bottom, container margin, actual navigation height and final banner reservation. Reading a transitioning banner spacer previously sized the canvas using stale space.

Validation: 33 hammer geometry cases across 11 phone/tablet sizes with 0/50/90 px banners. No board or navigation overlap; cancellation restores targeting state without shifting the board. Screenshot inspected against reference/game-reference.png. Menu layout (33 cases), ATT/copy consistency and reward settlement (15 sessions including hammer) passed.
Native build/TestFlight and physical-device confirmation pending.
Performance: no new assets/observers/render passes; tray rendering skipped during targeting. Device FPS/RAM not measured.
