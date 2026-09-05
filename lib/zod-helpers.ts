import { z } from "zod";

/**
 * Structural UUID check only — no RFC4122 version/variant enforcement.
 * Postgres's own `uuid` column type doesn't require those bits either;
 * Zod's built-in `.uuid()` does, which rejects this project's vanity seed
 * IDs (e.g. `00000000-0000-0000-0000-000000000004` — the version nibble
 * isn't 1-8). Real IDs from `gen_random_uuid()` always happen to satisfy
 * both checks anyway, so this only relaxes validation for exactly the
 * case where it was rejecting perfectly valid database values.
 */
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID");
