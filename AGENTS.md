# Architecture rules

- Normalize profile activity timestamps without timezone offsets as UTC and display both membership and activity dates in the same explicit timezone; this prevents device-dependent date shifts. Ignore activity dates earlier than membership and prefer the freshest valid profile/presence timestamp.