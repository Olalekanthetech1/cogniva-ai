import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const databaseRequire = createRequire(new URL("../../packages/database/package.json", import.meta.url));
const postgres = databaseRequire("postgres");

test("per-task adaptive routing settings are created pinned and preserve legacy task routes", {
  skip: !process.env.DATABASE_URL,
  timeout: 20_000
}, async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
  const rollbackMarker = new Error("ROLLBACK_AI_TASK_ROUTING_SETTINGS_FIXTURE");

  try {
    const settings = await sql.unsafe(
      "SELECT task, mode, updated_at FROM ai_task_routing_settings ORDER BY task"
    );

    assert.deepEqual(
      settings.map((row) => ({ task: row.task, mode: row.mode })),
      [
        { task: "learning_plan_generation", mode: "pinned" },
        { task: "socratic_tutor_response", mode: "pinned" }
      ]
    );

    const legacyRoutesBefore = await sql.unsafe(
      "SELECT task, provider, model FROM ai_task_routes ORDER BY task"
    );

    await assert.rejects(
      sql.begin(async (tx) => {
        await tx.unsafe(
          "UPDATE ai_task_routing_settings SET mode = 'adaptive' WHERE task = 'socratic_tutor_response'"
        );

        const [changed] = await tx.unsafe(
          "SELECT task, mode FROM ai_task_routing_settings WHERE task = 'socratic_tutor_response'"
        );
        assert.equal(changed.mode, "adaptive");

        throw rollbackMarker;
      }),
      (error) => error === rollbackMarker
    );

    const settingsAfterRollback = await sql.unsafe(
      "SELECT task, mode FROM ai_task_routing_settings ORDER BY task"
    );
    const legacyRoutesAfter = await sql.unsafe(
      "SELECT task, provider, model FROM ai_task_routes ORDER BY task"
    );

    assert.deepEqual(
      settingsAfterRollback.map((row) => ({ task: row.task, mode: row.mode })),
      [
        { task: "learning_plan_generation", mode: "pinned" },
        { task: "socratic_tutor_response", mode: "pinned" }
      ]
    );
    assert.deepEqual(legacyRoutesAfter, legacyRoutesBefore);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
