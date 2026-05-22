const { env } = require("../config/env");
const { importFoodPrices } = require("../modules/foodPrices/importer");

const parseArgs = (argv) => {
  const args = {
    all: false,
    dryRun: false,
    force: false,
    latest: false,
    limit: undefined,
    since: undefined,
    targetPath: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (value === "--all") {
      args.all = true;
      continue;
    }

    if (value === "--latest") {
      args.latest = true;
      continue;
    }

    if (value === "--force") {
      args.force = true;
      continue;
    }

    if (value.startsWith("--since=")) {
      args.since = value.slice("--since=".length);
      continue;
    }

    if (value === "--since") {
      args.since = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--limit") {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (!args.targetPath) {
      args.targetPath = value;
    }
  }

  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  args.targetPath = args.targetPath || env.FOOD_PRICES_PATH;

  if (!args.targetPath) {
    console.error(
      "Usage: npm run import:food-prices -- <file-or-folder> [--latest|--all|--since=YYYY-MM-DD] [--dry-run] [--force] [--limit 100]\nOr set FOOD_PRICES_PATH in Backend/.env."
    );
    process.exitCode = 1;
    return;
  }

  const summary = await importFoodPrices(args);

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
