import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { test } from "node:test";

const databaseRequire = createRequire(new URL("../../packages/database/package.json", import.meta.url));
const postgres = databaseRequire("postgres");

async function expectDatabaseFailure(transaction, query, code, message) {
  await assert.rejects(
    transaction.savepoint(async (savepoint) => query(savepoint)),
    (error) => error?.code === code,
    message
  );
}

test("adaptive model registry enforces provider identity, evidence gating, task eligibility and non-destructive routing", {
  skip: !process.env.DATABASE_URL,
  timeout: 30_000
}, async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
  try {
    const rollbackFixtures = new Error("ROLLBACK_AI_MODEL_REGISTRY_FIXTURES");
    try {
      await sql.begin(async (tx) => {
      const suffix = randomUUID();
      const modelId = "phase-1.3-registry-" + suffix;
      const routeModel = "legacy-route-" + suffix;
      const route = await tx.unsafe(
        "INSERT INTO ai_task_routes (task, provider, model) VALUES ('learning_plan_generation', 'gemini', $1) RETURNING model",
        [routeModel]
      );
      assert.equal(route[0].model, routeModel);

      const model = await tx.unsafe(
        "INSERT INTO ai_models (provider, model_id, display_name, status, capabilities) VALUES ('gemini', $1, 'Phase 1.3 Registry Test', 'pending', $2::jsonb) RETURNING id",
        [modelId, { reasoning: { kind: "unknown", parameter: null, levels: [] } }]
      );
      const registryId = model[0].id;

      const candidate = await tx.unsafe(
        "INSERT INTO ai_task_model_candidates (task, model_id) VALUES ('learning_plan_generation', $1) RETURNING is_enabled, priority",
        [registryId]
      );
      assert.equal(candidate[0].is_enabled, false);
      assert.equal(candidate[0].priority, 100);

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO ai_models (provider, model_id, display_name) VALUES ('gemini', $1, 'Duplicate Model')",
          [modelId]
        ),
        "23505",
        "A provider cannot register the same exact model ID twice."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "UPDATE ai_models SET status = 'enabled' WHERE id = $1",
          [registryId]
        ),
        "23514",
        "A model cannot be enabled without reviewed evidence and a successful test."
      );

      await tx.unsafe(
        "UPDATE ai_models SET capability_evidence_url = $2, capabilities_verified_at = now(), last_test_status = 'connected', last_tested_at = now(), status = 'enabled' WHERE id = $1",
        [registryId, "https://docs.example.invalid/models/" + encodeURIComponent(modelId)]
      );
      const enabled = await tx.unsafe(
        "SELECT status, last_test_status, capabilities_verified_at FROM ai_models WHERE id = $1",
        [registryId]
      );
      assert.equal(enabled[0].status, "enabled");
      assert.equal(enabled[0].last_test_status, "connected");
      assert.ok(enabled[0].capabilities_verified_at);

      await tx.unsafe(
        "UPDATE ai_task_model_candidates SET is_enabled = true, priority = 25 WHERE task = 'learning_plan_generation' AND model_id = $1",
        [registryId]
      );
      const eligible = await tx.unsafe(
        "SELECT is_enabled, priority FROM ai_task_model_candidates WHERE model_id = $1",
        [registryId]
      );
      assert.equal(eligible[0].is_enabled, true);
      assert.equal(eligible[0].priority, 25);

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "UPDATE ai_task_model_candidates SET priority = 10001 WHERE model_id = $1",
          [registryId]
        ),
        "23514",
        "Task-model priority must remain within its bounded range."
      );

      await expectDatabaseFailure(
        tx,
        (sp) => sp.unsafe(
          "INSERT INTO ai_task_model_candidates (task, model_id) VALUES ('learning_plan_generation', $1)",
          [randomUUID()]
        ),
        "23503",
        "Task candidates must reference a registered model."
      );

      const routeAfterRegistryChange = await tx.unsafe(
        "SELECT provider, model FROM ai_task_routes WHERE task = 'learning_plan_generation'"
      );
      assert.equal(routeAfterRegistryChange[0].provider, "gemini");
      assert.equal(routeAfterRegistryChange[0].model, routeModel);
        throw rollbackFixtures;
      });
    } catch (error) {
      if (error !== rollbackFixtures) throw error;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
});
