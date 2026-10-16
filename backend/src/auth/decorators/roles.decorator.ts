import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator gán quyền cho route.
 *
 * Sử dụng: @Roles(AdminRole.SUPER_ADMIN, AdminRole.EDITOR)
 */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
