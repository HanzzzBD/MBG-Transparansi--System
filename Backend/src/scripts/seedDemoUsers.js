const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../config/prisma");
const { BCRYPT_ROUNDS } = require("../utils/auth");

const prisma = getPrismaClient();

const DEMO_USERS = [
  {
    name: "Admin MBG",
    email: "admin@mbg.go.id",
    password: "password",
    role: "admin"
  },
  {
    name: "Pemerintah MBG",
    email: "gov@mbg.go.id",
    password: "password",
    role: "pemerintah"
  },
  {
    name: "Operator SPPG Demo",
    email: "sppg@mbg.go.id",
    password: "password",
    role: "sppg"
  },
  {
    name: "Operator Sekolah Demo",
    email: "sekolah@mbg.go.id",
    password: "password",
    role: "sekolah"
  }
];

const normalizeEmail = (email) => email.trim().toLowerCase();

const seedDemoUsers = async () => {
  const results = [];

  for (const demoUser of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demoUser.password, BCRYPT_ROUNDS);
    const email = normalizeEmail(demoUser.email);

    const user = await prisma.user.upsert({
      where: {
        email
      },
      update: {
        name: demoUser.name,
        password: passwordHash,
        role: demoUser.role,
        sppgId: null,
        schoolId: null,
        isActive: true,
        deletedAt: null
      },
      create: {
        name: demoUser.name,
        email,
        password: passwordHash,
        role: demoUser.role,
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

    results.push(user);
  }

  return results;
};

const run = async () => {
  const users = await seedDemoUsers();

  console.log("Seed demo users selesai.");
  console.log(
    JSON.stringify(
      {
        count: users.length,
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }))
      },
      null,
      2
    )
  );
};

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Seed demo users gagal:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  DEMO_USERS,
  seedDemoUsers
};
