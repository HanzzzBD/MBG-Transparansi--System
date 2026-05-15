const { env } = require("./env");

let prismaInstance;

const buildPrismaPgAdapter = () => {
  const { PrismaPg } = require("@prisma/adapter-pg");

  const databaseUrl = new URL(env.DATABASE_URL);
  const schema = databaseUrl.searchParams.get("schema") || undefined;
  const adapterOptions = schema ? { schema } : undefined;

  return new PrismaPg(
    {
      connectionString: env.DATABASE_URL
    },
    adapterOptions
  );
};

const getPrismaClient = () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!prismaInstance) {
    const { PrismaClient } = require("@prisma/client");
    const adapter = buildPrismaPgAdapter();

    prismaInstance = new PrismaClient({
      adapter,
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }

  return prismaInstance;
};

module.exports = {
  getPrismaClient
};
