INSERT INTO "permissions" ("key", "name", "description", "group")
VALUES
  (
    'sppg.status.read',
    'Read SPPG Operational Status',
    'Read SPPG operational status for lists, details, and geospatial markers.',
    'sppg'
  ),
  (
    'sppg.status.update',
    'Update SPPG Operational Status',
    'Update SPPG operational status with audit trail.',
    'sppg'
  )
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "group" = EXCLUDED."group",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("role", "permission_id")
SELECT role_values.role::"UserRole", p.id
FROM (
  VALUES
    ('admin', 'sppg.status.read'),
    ('admin', 'sppg.status.update'),
    ('pemerintah', 'sppg.status.read'),
    ('sppg', 'sppg.status.read'),
    ('sekolah', 'sppg.status.read')
) AS role_values(role, permission_key)
JOIN "permissions" p ON p."key" = role_values.permission_key
ON CONFLICT ("role", "permission_id") DO NOTHING;
