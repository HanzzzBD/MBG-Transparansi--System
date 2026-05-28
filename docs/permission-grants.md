# Permission Grants

## Default Role Grants

The permission layer is additive and does not replace existing roles. Existing roles remain valid:

- `admin`
- `pemerintah`
- `gov`
- `sppg`
- `sekolah`
- `umum`

`gov` is treated as an alias-compatible government role alongside the existing `pemerintah` role.

## Legacy Compatibility

The `sppg` role is temporarily seeded with these permissions because the previous SPPG role could perform these actions before the grant system existed:

- `daily_menu.price.validate`
- `distribution.mark_sent`

These grants can be split later when separate SPPG operator and SPPG supervisor accounts are enforced through permission checks.
