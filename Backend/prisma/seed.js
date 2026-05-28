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
  },
  {
    key: "banper_regular_amount",
    value: 13000,
    description: "BGN regular Banper allocation per meal portion."
  },
  {
    key: "banper_special_amount",
    value: 15000,
    description: "BGN special Banper allocation per meal portion."
  },
  {
    key: "raw_material_min_per_portion",
    value: 8000,
    description: "BGN minimum raw material cost per meal portion."
  },
  {
    key: "raw_material_max_per_portion",
    value: 10000,
    description: "BGN maximum raw material cost per meal portion."
  },
  {
    key: "operational_max_per_portion",
    value: 3000,
    description: "BGN maximum operational cost per meal portion."
  },
  {
    key: "rent_max_per_portion",
    value: 2000,
    description: "BGN maximum rent cost per meal portion."
  }
];

const DEFAULT_PERMISSIONS = [
  {
    key: "admin.dashboard.view",
    name: "View Admin Dashboard",
    group: "admin",
    description: "Access the internal admin dashboard summary."
  },
  {
    key: "admin.map.view",
    name: "View Admin SPPG Map",
    group: "admin",
    description: "Access internal SPPG map monitoring."
  },
  {
    key: "admin.analytics.view",
    name: "View Admin Analytics",
    group: "admin",
    description: "Access internal analytics pages and endpoints."
  },
  {
    key: "admin.budget.view",
    name: "View Admin Budget",
    group: "admin",
    description: "Access budget transparency and costing analytics."
  },
  {
    key: "admin.public_reports.view",
    name: "View Public Reports",
    group: "admin",
    description: "Access public report moderation dashboards."
  },
  {
    key: "admin.anomaly.view",
    name: "View Anomaly Detection",
    group: "admin",
    description: "Access anomaly detection dashboards."
  },
  {
    key: "admin.audit_log.view",
    name: "View Audit Log",
    group: "admin",
    description: "Access audit log dashboards."
  },
  {
    key: "admin.export.view",
    name: "View Export Data",
    group: "admin",
    description: "Access export data pages and export history."
  },
  {
    key: "admin.master_sppg.manage",
    name: "Manage Master SPPG",
    group: "admin",
    description: "Create, update, restore, or delete SPPG master data."
  },
  {
    key: "admin.sppg.manage",
    name: "Manage SPPG",
    group: "admin",
    description: "Access and manage SPPG administration pages."
  },
  {
    key: "sppg.status.read",
    name: "Read SPPG Operational Status",
    group: "sppg",
    description: "Read SPPG operational status for lists, details, and geospatial markers."
  },
  {
    key: "sppg.status.update",
    name: "Update SPPG Operational Status",
    group: "sppg",
    description: "Update SPPG operational status with audit trail."
  },
  {
    key: "admin.master_school.manage",
    name: "Manage Master School",
    group: "admin",
    description: "Create, update, restore, or delete school master data."
  },
  {
    key: "admin.school.manage",
    name: "Manage School",
    group: "admin",
    description: "Access and manage school administration pages."
  },
  {
    key: "admin.dapodik.manage",
    name: "Manage Dapodik Import",
    group: "admin",
    description: "Access Dapodik import and promotion workflows."
  },
  {
    key: "admin.lock_unlock.manage",
    name: "Manage Lock Unlock",
    group: "admin",
    description: "Lock or unlock distribution records."
  },
  {
    key: "admin.override.manage",
    name: "Manage Data Override",
    group: "admin",
    description: "Override locked operational data with audit trail."
  },
  {
    key: "admin.api_monitoring.view",
    name: "View API Monitoring",
    group: "admin",
    description: "Access API monitoring and health dashboards."
  },
  {
    key: "admin.users.manage",
    name: "Manage Admin Users",
    group: "admin",
    description: "Manage internal user accounts and role assignments."
  },
  {
    key: "admin.settings.manage",
    name: "Manage Admin Settings",
    group: "admin",
    description: "View or update internal system configuration."
  },
  {
    key: "permission.view",
    name: "View Permissions",
    group: "permission",
    description: "View permission catalog and grants."
  },
  {
    key: "permission.manage",
    name: "Manage Permissions",
    group: "permission",
    description: "Create or update permission definitions."
  },
  {
    key: "permission.grant",
    name: "Grant Permissions",
    group: "permission",
    description: "Grant permissions to roles or users."
  },
  {
    key: "permission.revoke",
    name: "Revoke Permissions",
    group: "permission",
    description: "Revoke role or user permission grants."
  },
  {
    key: "permission.manage_role_default",
    name: "Manage Role Default Permissions",
    group: "permission",
    description: "Manage sensitive role-default or permission-management grants."
  },
  {
    key: "daily_menu.view",
    name: "View Daily Menu",
    group: "daily_menu",
    description: "View daily SPPG menus."
  },
  {
    key: "daily_menu.create",
    name: "Create Daily Menu",
    group: "daily_menu",
    description: "Input daily menu data."
  },
  {
    key: "daily_menu.update",
    name: "Update Daily Menu",
    group: "daily_menu",
    description: "Update daily menu data."
  },
  {
    key: "daily_menu.delete",
    name: "Delete Daily Menu",
    group: "daily_menu",
    description: "Delete daily menu data."
  },
  {
    key: "daily_menu.photo.upload",
    name: "Upload Menu Photo",
    group: "daily_menu",
    description: "Upload menu or distribution proof photos."
  },
  {
    key: "daily_menu.price.validate",
    name: "Validate Menu Price",
    group: "daily_menu",
    description: "Validate daily menu or cost per portion against thresholds."
  },
  {
    key: "daily_menu.price.override",
    name: "Override Menu Price",
    group: "daily_menu",
    description: "Override menu or distribution costing after review."
  },
  {
    key: "daily_menu.approve",
    name: "Approve Daily Menu",
    group: "daily_menu",
    description: "Approve daily SPPG menus."
  },
  {
    key: "production.view",
    name: "View Production",
    group: "production",
    description: "View production batch and portion data."
  },
  {
    key: "production.create",
    name: "Create Production",
    group: "production",
    description: "Input production batch and portion data."
  },
  {
    key: "production.update",
    name: "Update Production",
    group: "production",
    description: "Update production batch and portion data."
  },
  {
    key: "production.delete",
    name: "Delete Production",
    group: "production",
    description: "Delete production batch data."
  },
  {
    key: "distribution.view",
    name: "View Distribution",
    group: "distribution",
    description: "View distribution records."
  },
  {
    key: "distribution.create",
    name: "Create Distribution",
    group: "distribution",
    description: "Input distribution portions and destination school."
  },
  {
    key: "distribution.update",
    name: "Update Distribution",
    group: "distribution",
    description: "Update distribution data."
  },
  {
    key: "distribution.correct",
    name: "Correct Distribution",
    group: "distribution",
    description: "Correct distribution data before it is sent."
  },
  {
    key: "distribution.mark_sent",
    name: "Mark Distribution Sent",
    group: "distribution",
    description: "Mark a distribution as sent or delivered."
  },
  {
    key: "distribution.confirm",
    name: "Confirm Distribution",
    group: "distribution",
    description: "Confirm receipt of a distribution."
  },
  {
    key: "distribution.report_issue",
    name: "Report Distribution Issue",
    group: "distribution",
    description: "Report an issue for a received distribution."
  },
  {
    key: "distribution.proof.upload",
    name: "Upload Distribution Proof",
    group: "distribution",
    description: "Upload delivery proof for a distribution."
  },
  {
    key: "sppg.school_channel.view",
    name: "View SPPG School Channel",
    group: "distribution",
    description: "View schools assigned as SPPG distribution channels."
  },
  {
    key: "sppg.school_channel.manage",
    name: "Manage SPPG School Channel",
    group: "distribution",
    description: "Assign or unassign schools as SPPG distribution channels."
  },
  {
    key: "issue.view",
    name: "View Issues",
    group: "issue",
    description: "View internal issues or school reports."
  },
  {
    key: "issue.create",
    name: "Create Issue",
    group: "issue",
    description: "Create an internal SPPG issue."
  },
  {
    key: "issue.update_status",
    name: "Update Issue Status",
    group: "issue",
    description: "Update issue workflow status."
  },
  {
    key: "issue.resolve",
    name: "Resolve Issue",
    group: "issue",
    description: "Resolve issue or report follow-up."
  },
  {
    key: "audit.view",
    name: "View Audit",
    group: "audit",
    description: "View audit logs."
  },
  {
    key: "audit.export",
    name: "Export Audit",
    group: "audit",
    description: "Export audit or operational logs."
  },
  {
    key: "user.view",
    name: "View Users",
    group: "user",
    description: "View user accounts."
  },
  {
    key: "user.create",
    name: "Create Users",
    group: "user",
    description: "Create user accounts."
  },
  {
    key: "user.update",
    name: "Update Users",
    group: "user",
    description: "Update user accounts."
  },
  {
    key: "user.delete",
    name: "Delete Users",
    group: "user",
    description: "Delete or deactivate user accounts."
  },
  {
    key: "user.lock",
    name: "Lock Users",
    group: "user",
    description: "Disable or lock user accounts."
  },
  {
    key: "user.unlock",
    name: "Unlock Users",
    group: "user",
    description: "Reactivate or unlock user accounts."
  },
  {
    key: "account.view",
    name: "View Account",
    group: "user",
    description: "View own account profile."
  },
  {
    key: "account.update",
    name: "Update Account",
    group: "user",
    description: "Update own account profile."
  }
];

const ADMIN_PERMISSION_KEYS = DEFAULT_PERMISSIONS.map((permission) => permission.key);
const PEMERINTAH_PERMISSION_KEYS = [
  "admin.dashboard.view",
  "admin.map.view",
  "admin.analytics.view",
  "admin.budget.view",
  "admin.public_reports.view",
  "admin.anomaly.view",
  "admin.audit_log.view",
  "admin.export.view",
  "sppg.status.read",
  "audit.view",
  "distribution.view",
  "production.view",
  "issue.view"
];
const SPPG_PERMISSION_KEYS = [
  "account.view",
  "account.update",
  "daily_menu.view",
  "daily_menu.create",
  "daily_menu.update",
  "production.view",
  "production.create",
  "production.update",
  "distribution.view",
  "distribution.create",
  "sppg.school_channel.view",
  "sppg.school_channel.manage",
  "sppg.status.read",
  "issue.view"
];
const SPPG_SUPERVISOR_PERMISSION_KEYS = [
  "daily_menu.price.validate",
  "daily_menu.price.override",
  "distribution.mark_sent"
];
const SEKOLAH_PERMISSION_KEYS = [
  "account.view",
  "account.update",
  "distribution.view",
  "distribution.confirm",
  "distribution.report_issue",
  "sppg.status.read",
  "issue.view"
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: ADMIN_PERMISSION_KEYS,
  pemerintah: PEMERINTAH_PERMISSION_KEYS,
  sppg: SPPG_PERMISSION_KEYS,
  sekolah: SEKOLAH_PERMISSION_KEYS
};

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

const seedPermissions = async () => {
  const permissionByKey = new Map();

  for (const permission of DEFAULT_PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: {
        key: permission.key
      },
      update: {
        name: permission.name,
        description: permission.description ?? null,
        group: permission.group ?? null
      },
      create: permission
    });

    permissionByKey.set(saved.key, saved);
  }

  let rolePermissionCount = 0;

  await prisma.rolePermission.deleteMany({
    where: {
      role: "gov"
    }
  });

  for (const [role, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await prisma.rolePermission.deleteMany({
      where: {
        role,
        permission: {
          key: {
            notIn: permissionKeys
          }
        }
      }
    });

    for (const permissionKey of permissionKeys) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        throw new Error(`Permission ${permissionKey} is not registered.`);
      }

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          role,
          permissionId: permission.id
        }
      });

      rolePermissionCount += 1;
    }
  }

  return {
    permissions: permissionByKey.size,
    rolePermissions: rolePermissionCount,
    sppgGrantModel: {
      defaultRole: "operator",
      supervisorAdditionalPermissions: SPPG_SUPERVISOR_PERMISSION_KEYS
    }
  };
};

const run = async () => {
  const result = {
    admin: await seedAdmin(),
    systemConfigs: await seedSystemConfigs(),
    permissions: await seedPermissions()
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
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  seedAdmin,
  seedPermissions,
  seedSystemConfigs
};
