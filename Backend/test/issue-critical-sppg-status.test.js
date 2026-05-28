const test = require("node:test");
const assert = require("node:assert/strict");

const { isCriticalIssueCategory } = require("../src/modules/issues/service");

test("marks operationally blocking issue categories as critical", () => {
  assert.equal(isCriticalIssueCategory("kekurangan_bahan"), true);
  assert.equal(isCriticalIssueCategory("peralatan"), true);
  assert.equal(isCriticalIssueCategory("logistik"), true);
});

test("does not treat delay or miscellaneous categories as critical by default", () => {
  assert.equal(isCriticalIssueCategory("keterlambatan"), false);
  assert.equal(isCriticalIssueCategory("lainnya"), false);
});
