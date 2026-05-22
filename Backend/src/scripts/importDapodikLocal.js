const { env } = require("../config/env");
const { getPrismaClient } = require("../config/prisma");
const { DEFAULT_BATCH_SIZE, importDapodikDatasetFromDirectory } = require("../modules/dapodik/importer");

const prisma = getPrismaClient();

const parseArgs = (argv) => {
  const args = argv.slice(2);
  let directoryPathProvided = false;
  const options = {
    directoryPath: env.DAPODIK_DATA_DIR || null,
    semesterId: env.DAPODIK_DEFAULT_SEMESTER_ID,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--semester-id") {
      const nextValue = args[index + 1];

      if (!/^\d{5}$/.test(nextValue || "")) {
        throw new Error("Nilai --semester-id harus berupa 5 digit, contoh: 20252.");
      }

      options.semesterId = nextValue;
      index += 1;
      continue;
    }

    if (arg === "--batch-size") {
      const nextValue = Number.parseInt(args[index + 1], 10);

      if (!Number.isInteger(nextValue) || nextValue <= 0) {
        throw new Error("Nilai --batch-size harus berupa integer positif.");
      }

      options.batchSize = nextValue;
      index += 1;
      continue;
    }

    if (!directoryPathProvided) {
      options.directoryPath = arg;
      directoryPathProvided = true;
      continue;
    }

    throw new Error(`Argumen tidak dikenal: ${arg}`);
  }

  if (!options.directoryPath) {
    throw new Error(
      "Path folder dataset Dapodik wajib diberikan. Contoh: npm run import:dapodik -- C:\\path\\dapodik"
    );
  }

  return options;
};

const printSummary = (summary) => {
  console.log("Import Dapodik lokal selesai.");
  console.log(JSON.stringify(summary, null, 2));
};

const formatCliError = (error) => {
  const message = error?.message || "Unknown error.";

  if (
    message.includes("does not exist in the current database") ||
    message.includes("does not exist")
  ) {
    return `${message}\nHint: jalankan migration baru dulu dengan 'npm run prisma:migrate' agar tabel staging Dapodik tersedia.`;
  }

  return message;
};

const runCli = async () => {
  const options = parseArgs(process.argv);
  const summary = await importDapodikDatasetFromDirectory(options);
  printSummary(summary);
};

if (require.main === module) {
  runCli()
    .catch((error) => {
      console.error("Import Dapodik lokal gagal:", formatCliError(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
