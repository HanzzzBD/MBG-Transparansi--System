const test = require("node:test");
const assert = require("node:assert/strict");

const { assertValidExportDateFilters } = require("../src/modules/exports/validation");

test("accepts valid export date filters from filterParams", () => {
  assert.deepEqual(
    assertValidExportDateFilters({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-28"
    }),
    {
      date: null,
      startDate: "2026-05-01",
      endDate: "2026-05-28"
    }
  );
});

test("rejects invalid export date filters before export job creation", () => {
  assert.throws(
    () =>
      assertValidExportDateFilters({
        dateFrom: "bad-date",
        dateTo: "2026-05-28"
      }),
    (error) => error.statusCode === 400 && error.code === "EXPORT_FILTER_DATE_INVALID"
  );
});

test("rejects export date ranges where start date is after end date", () => {
  assert.throws(
    () =>
      assertValidExportDateFilters({
        start_date: "2026-05-29",
        end_date: "2026-05-28"
      }),
    (error) => error.statusCode === 400 && error.code === "EXPORT_FILTER_DATE_RANGE_INVALID"
  );
});
