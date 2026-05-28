const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapMarkersSchema,
  updateSppgStatusSchema
} = require("../src/modules/sppg/validation");

test("accepts supported SPPG operational status values", () => {
  assert.doesNotThrow(() =>
    updateSppgStatusSchema.parse({
      body: { status: "problem" },
      params: { id: 1 },
      query: {}
    })
  );
});

test("rejects unsupported SPPG operational status values", () => {
  assert.throws(() =>
    updateSppgStatusSchema.parse({
      body: { status: "maintenance" },
      params: { id: 1 },
      query: {}
    })
  );
});

test("accepts SPPG map marker status filter", () => {
  const parsed = mapMarkersSchema.parse({
    body: {},
    params: {},
    query: { status: "inactive" }
  });

  assert.equal(parsed.query.status, "inactive");
});
