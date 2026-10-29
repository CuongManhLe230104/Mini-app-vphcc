import { Prisma } from '@prisma/client';

/**
 * Khóa dòng CounterDay của (quầy, ngày) để tuần tự hóa cấp số/giữ chỗ trong cùng giao dịch.
 * Phải là câu lệnh ĐẦU TIÊN của transaction (ReadCommitted) để các lần đếm phía sau thấy dữ liệu đã commit.
 */
export async function lockCounterDay(tx: Prisma.TransactionClient, counterId: string, serviceDate: string) {
  await tx.$executeRaw`INSERT IGNORE INTO CounterDay (id, counterId, serviceDate, lastSequence) VALUES (UUID(), ${counterId}, ${serviceDate}, 0)`;
  const rows = await tx.$queryRaw<{ id: string; lastSequence: number }[]>`
    SELECT id, lastSequence FROM CounterDay WHERE counterId = ${counterId} AND serviceDate = ${serviceDate} FOR UPDATE`;
  if (!rows.length) throw new Error('Không khóa được dòng quầy/ngày');
  return { id: rows[0].id, lastSequence: Number(rows[0].lastSequence) };
}

export async function nextSequence(tx: Prisma.TransactionClient, dayId: string, current: number): Promise<number> {
  const next = current + 1;
  await tx.counterDay.update({ where: { id: dayId }, data: { lastSequence: next } });
  return next;
}

export const TX_OPTIONS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 };

/** Thử lại khi trùng khóa duy nhất ngẫu nhiên hoặc deadlock; các lỗi khác ném ra ngay. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err: any) {
      const retryable = err?.code === 'P2002' || err?.code === 'P2034' || /deadlock|lock wait timeout/i.test(String(err?.message));
      if (!retryable) throw err;
      last = err;
      await new Promise(r => setTimeout(r, 25 * (i + 1) + Math.floor(Math.random() * 25)));
    }
  }
  throw last;
}

