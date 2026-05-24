const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../src/config/prisma");

const prisma = getPrismaClient();

const BCRYPT_ROUNDS = 12;
const DEFAULT_ADMIN_EMAIL = "admin@mbg.local";
const DEFAULT_ADMIN_NAME = "Super Admin";
const DEFAULT_ADMIN_PASSWORD = "Admin12345!";
const DEFAULT_SYSTEM_CONFIGS = [
  {
    key: "export_max_rows",
    value: 50000,
    description: "Maximum rows allowed for generated export files."
  }
];

const normalizeText = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeEmail = (value) => normalizeText(value, DEFAULT_ADMIN_EMAIL).toLowerCase();

const getSeedAdmin = () => {
  const usesDefaultPassword = !process.env.SEED_ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production" && usesDefaultPassword) {
    throw new Error("SEED_ADMIN_PASSWORD is required when seeding admin in production.");
  }

  return {
    name: normalizeText(process.env.SEED_ADMIN_NAME, DEFAULT_ADMIN_NAME),
    email: normalizeEmail(process.env.SEED_ADMIN_EMAIL),
    password: normalizeText(process.env.SEED_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD),
    usesDefaultPassword
  };
};

const seedAdmin = async () => {
  const admin = getSeedAdmin();
  const passwordHash = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: {
      email: admin.email
    },
    update: {
      name: admin.name,
      password: passwordHash,
      role: "admin",
      sppgId: null,
      schoolId: null,
      isActive: true,
      deletedAt: null
    },
    create: {
      name: admin.name,
      email: admin.email,
      password: passwordHash,
      role: "admin",
      isActive: true
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  return {
    user,
    password: admin.usesDefaultPassword ? admin.password : "[from SEED_ADMIN_PASSWORD]"
  };
};

const seedSystemConfigs = async () => {
  const configs = [];

  for (const config of DEFAULT_SYSTEM_CONFIGS) {
    const saved = await prisma.systemConfig.upsert({
      where: {
        key: config.key
      },
      update: {},
      create: config
    });

    configs.push(saved);
  }

  return configs;
};

const run = async () => {
  const result = {
    admin: await seedAdmin(),
    systemConfigs: await seedSystemConfigs()
  };

  console.log("Seed admin selesai.");
  console.log(JSON.stringify(result, null, 2));
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Seed admin gagal:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  seedAdmin,
  seedSystemConfigs
};
