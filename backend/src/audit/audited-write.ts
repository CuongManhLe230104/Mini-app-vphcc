import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Content and audit record commit together; never store content or credentials in logs. */
export async function auditedWrite<T>(prisma: PrismaService, adminId: string | undefined,
  action: string, resource: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    const result = await write(tx);
    await tx.auditLog.create({ data: { adminId, action, resource: resource.includes(":") ? resource : resource + ":" + String((result as any)?.id || ":new") } });
    return result;
  });
}
