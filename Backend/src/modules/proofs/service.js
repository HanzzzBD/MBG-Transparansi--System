const { getPrismaClient } = require("../../config/prisma");
const AppError = require("../../utils/appError");
const { createAuditLog } = require("../../utils/auditLog");
const { assertSchoolOwnership, assertSppgOwnership } = require("../../utils/ownership");

const prisma = getPrismaClient();

const proofInclude = {
  file: true,
  uploader: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sppgId: true
    }
  },
  distribution: {
    include: {
      sppg: true,
      school: true
    }
  }
};

const getDistributionById = async (id) => {
  const distribution = await prisma.distribution.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      sppg: true,
      school: true
    }
  });

  if (!distribution) {
    throw new AppError("Distribution not found.", 404, "DISTRIBUTION_NOT_FOUND");
  }

  if (distribution.sppg?.deletedAt) {
    throw new AppError("Distribution SPPG is no longer active.", 404, "SPPG_NOT_FOUND");
  }

  if (distribution.school?.deletedAt) {
    throw new AppError("Distribution school is no longer active.", 404, "SCHOOL_NOT_FOUND");
  }

  return distribution;
};

const getFileById = async (id) => {
  const file = await prisma.file.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      uploader: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sppgId: true
        }
      }
    }
  });

  if (!file) {
    throw new AppError("File not found.", 404, "FILE_NOT_FOUND");
  }

  if (file.status !== "ready") {
    throw new AppError("File is not ready to be attached.", 400, "FILE_NOT_READY");
  }

  return file;
};

const ensureDistributionAccess = (user, distribution) => {
  if (user.role === "sppg") {
    assertSppgOwnership(user, distribution.sppgId);
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, distribution.schoolId);
  }
};

const listDistributionProofs = async ({ distributionId, user }) => {
  const distribution = await getDistributionById(distributionId);
  ensureDistributionAccess(user, distribution);

  const proofs = await prisma.proof.findMany({
    where: {
      distributionId: distribution.id
    },
    include: proofInclude,
    orderBy: [{ createdAt: "desc" }]
  });

  return {
    data: proofs
  };
};

const createProof = async ({ payload, user, ipAddress }) => {
  const [distribution, file] = await Promise.all([
    getDistributionById(payload.distributionId),
    getFileById(payload.fileId)
  ]);

  if (user.role === "sppg") {
    assertSppgOwnership(user, distribution.sppgId);
  }

  if (user.role === "sekolah") {
    assertSchoolOwnership(user, distribution.schoolId);
  }

  if (
    user.role !== "admin" &&
    Number(file.uploadedBy) !== Number(user.userId) &&
    Number(file.uploader?.sppgId) !== Number(user.sppgId)
  ) {
    throw new AppError("You can only attach files uploaded within your own SPPG scope.", 403, "FILE_SCOPE_FORBIDDEN");
  }

  const existing = await prisma.proof.findFirst({
    where: {
      distributionId: distribution.id,
      fileId: file.id
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw new AppError("This file is already attached to the distribution.", 409, "PROOF_ALREADY_EXISTS");
  }

  const proof = await prisma.$transaction(async (tx) => {
    const created = await tx.proof.create({
      data: {
        distributionId: distribution.id,
        fileId: file.id,
        uploadedBy: user.userId
      },
      include: proofInclude
    });

    await createAuditLog({
      prisma: tx,
      userId: user.userId,
      action: "INSERT",
      tableName: "proofs",
      recordId: created.id,
      newData: created,
      ipAddress
    });

    return created;
  });

  return {
    data: proof
  };
};

module.exports = {
  createProof,
  listDistributionProofs
};
