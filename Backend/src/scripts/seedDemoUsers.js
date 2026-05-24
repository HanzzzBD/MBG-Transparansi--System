const bcrypt = require("bcrypt");

const { getPrismaClient } = require("../config/prisma");
const { BCRYPT_ROUNDS } = require("../utils/auth");

const prisma = getPrismaClient();

const DEMO_SPPG = {
  name: "SPPG Demo MBG",
  province: "Prov. Jawa Barat",
  city: "Kab. Bogor",
  address: "Jl. Demo MBG No. 1",
  lat: -6.595,
  lng: 106.816,
  capacity: 1000,
  workers: 24,
  picName: "Koordinator Demo SPPG",
  picPhone: "080000000001",
  status: "active"
};

const DEMO_SCHOOL = {
  name: "SD Demo MBG",
  province: "Prov. Jawa Barat",
  city: "Kab. Bogor",
  district: "Kec. Demo",
  address: "Jl. Sekolah Demo MBG No. 1",
  totalStudents: 320,
  npsn: "99900099",
  educationLevel: "SD",
  schoolStatus: "Negeri"
};

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

const findOrCreateDemoSppg = async () => {
  const activeSppg = await prisma.sppg.findFirst({
    where: {
      deletedAt: null
    },
    orderBy: {
      id: "asc"
    },
    select: {
      id: true
    }
  });

  if (activeSppg) {
    return activeSppg;
  }

  const existingDemoSppg = await prisma.sppg.findFirst({
    where: {
      name: DEMO_SPPG.name
    },
    orderBy: {
      id: "asc"
    },
    select: {
      id: true
    }
  });

  if (existingDemoSppg) {
    return prisma.sppg.update({
      where: {
        id: existingDemoSppg.id
      },
      data: {
        ...DEMO_SPPG,
        deletedAt: null
      },
      select: {
        id: true
      }
    });
  }

  return prisma.sppg.create({
    data: DEMO_SPPG,
    select: {
      id: true
    }
  });
};

const findOrCreateDemoSchool = async (sppgId) => {
  const activeSchool = await prisma.school.findFirst({
    where: {
      deletedAt: null,
      sppg: {
        deletedAt: null
      }
    },
    orderBy: {
      id: "asc"
    },
    select: {
      id: true,
      sppgId: true
    }
  });

  if (activeSchool) {
    return activeSchool;
  }

  return prisma.school.upsert({
    where: {
      npsn: DEMO_SCHOOL.npsn
    },
    update: {
      ...DEMO_SCHOOL,
      sppgId,
      deletedAt: null
    },
    create: {
      ...DEMO_SCHOOL,
      sppgId
    },
    select: {
      id: true,
      sppgId: true
    }
  });
};

const resolveDemoScopes = async () => {
  const fallbackSppg = await findOrCreateDemoSppg();
  const school = await findOrCreateDemoSchool(fallbackSppg.id);

  return {
    sppgId: school.sppgId,
    schoolId: school.id
  };
};

const getUserScope = (role, scopes) => {
  if (role === "sppg") {
    return {
      sppgId: scopes.sppgId,
      schoolId: null
    };
  }

  if (role === "sekolah") {
    return {
      sppgId: null,
      schoolId: scopes.schoolId
    };
  }

  return {
    sppgId: null,
    schoolId: null
  };
};

const seedDemoUsers = async () => {
  const results = [];
  const scopes = await resolveDemoScopes();

  for (const demoUser of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demoUser.password, BCRYPT_ROUNDS);
    const email = normalizeEmail(demoUser.email);
    const userScope = getUserScope(demoUser.role, scopes);

    const user = await prisma.user.upsert({
      where: {
        email
      },
      update: {
        name: demoUser.name,
        password: passwordHash,
        role: demoUser.role,
        ...userScope,
        isActive: true,
        deletedAt: null
      },
      create: {
        name: demoUser.name,
        email,
        password: passwordHash,
        role: demoUser.role,
        ...userScope,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sppgId: true,
        schoolId: true,
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
          sppgId: user.sppgId,
          schoolId: user.schoolId,
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
  resolveDemoScopes,
  seedDemoUsers
};
