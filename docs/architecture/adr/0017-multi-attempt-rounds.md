# ADR-0017: Persist multi-attempt rounds and reveal on finish

Status: Accepted

## Decision

Solo games store a validated `attemptsPerRound` value from 1 to 5. The default remains one, preserving existing callers; challenge games always use one attempt. Each custom attempt is stored as a `RoundAttempt` row with its calculated distance and score. Intermediate responses include the current attempt number, distance, and score, but no correct-location coordinates or answer flags.

The player can finish after any saved attempt. The round result is derived from the best saved attempt using score descending, distance ascending, submission time ascending, and ID ascending. The last configured attempt finalizes automatically. Finalization writes the legacy `Guess` and `Result` records, closes the round, and completes the game when it was the final round. This preserves the existing results API and retention behavior.

Attempt submission and finish acquire a PostgreSQL row lock on the parent round, recheck its active state, and execute in a transaction. A unique `(roundId, attemptNumber)` index is a second guard. Concurrent losers receive a conflict and may retry; they cannot exceed the configured limit or add attempts after finalization. The legacy one-submit route remains supported for one-attempt rounds and rejects configured multi-attempt rounds.

## Consequences

- Existing games migrate with one attempt per round and existing records are unchanged.
- Attempts remain attached to the round and are removed when its game is removed.
- The final score reflects the player's best submitted attempt; intermediate feedback does not reveal the answer.
- Live multiplayer attempt synchronization remains out of scope until room sessions exist.
