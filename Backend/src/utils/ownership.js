const AppError = require("./appError");

const getUserScope = (user) => ({
  schoolId: user?.schoolId ?? null,
  sppgId: user?.sppgId ?? null,
  role: user?.role ?? null,
  userId: user?.userId ?? user?.id ?? null
});

const requireSppgScope = (user) => {
  const scope = getUserScope(user);

  if (!scope.sppgId) {
    throw new AppError("Authenticated SPPG user is not linked to any SPPG.", 403, "SPPG_SCOPE_MISSING");
  }

  return scope.sppgId;
};

const requireSchoolScope = (user) => {
  const scope = getUserScope(user);

  if (!scope.schoolId) {
    throw new AppError(
      "Authenticated sekolah user is not linked to any school.",
      403,
      "SCHOOL_SCOPE_MISSING"
    );
  }

  return scope.schoolId;
};

const assertSppgOwnership = (user, sppgId) => {
  if (user.role === "admin" || user.role === "pemerintah") {
    return;
  }

  const scopedSppgId = requireSppgScope(user);

  if (Number(scopedSppgId) !== Number(sppgId)) {
    throw new AppError("You can only access data for your own SPPG.", 403, "SPPG_SCOPE_FORBIDDEN");
  }
};

const assertSchoolOwnership = (user, schoolId) => {
  if (user.role === "admin" || user.role === "pemerintah") {
    return;
  }

  const scopedSchoolId = requireSchoolScope(user);

  if (Number(scopedSchoolId) !== Number(schoolId)) {
    throw new AppError("You can only access data for your own school.", 403, "SCHOOL_SCOPE_FORBIDDEN");
  }
};

module.exports = {
  assertSchoolOwnership,
  assertSppgOwnership,
  getUserScope,
  requireSchoolScope,
  requireSppgScope
};
