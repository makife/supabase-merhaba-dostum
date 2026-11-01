# Architecture rules

- Android home layout uses native window bounds converted from physical to CSS pixels and visibility-independent system-bar/cutout insets; pin them at startup, exclude IME, and inset the whole home layer so transient bars cannot stretch islands or controls. Never derive CSS layout height from screen.height.

- Normalize profile activity timestamps without timezone offsets as UTC and display both membership and activity dates in the same explicit timezone; this prevents device-dependent date shifts. Ignore activity dates earlier than membership and prefer the freshest valid profile/presence timestamp.
- Random-match and private-room bot difficulty scales with the player's rank group (`getRankTier(profile.rank_points)` → per-group min/max word delay + word-length weights in GamePage's `scheduleNextAIWord`); tournament bots keep round-based difficulty. Values live only in that table so they can be tuned in one place.