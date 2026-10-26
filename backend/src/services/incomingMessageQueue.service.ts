import { store } from './store.service';

export type IncomingChannel = 'META' | 'BAILEYS';
type IncomingPayload = { phone: string; text: string; senderName?: string; waMessageId?: string; sourceChannel: IncomingChannel };
type QueueJob = IncomingPayload & { id: string; attempts: number };

class IncomingMessageQueueService {
  private active = 0;
  private polling = false;
  private handler?: (payload: IncomingPayload) => Promise<unknown>;
  private timer?: NodeJS.Timeout;
  private readonly concurrency = 4;
  private readonly maxAttempts = 5;

  public async initialize(handler: (payload: IncomingPayload) => Promise<unknown>) {
    this.handler = handler;
    await store.waitUntilReady();
    const db = store.getDatabaseClient();
    if (!db) return false;
    // Recupera trabajos interrumpidos por reinicios; mantiene los intentos previos.
    await db.incomingMessageJob.updateMany({
      where: { status: 'PROCESSING', lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      data: { status: 'PENDING', lockedAt: null, availableAt: new Date() },
    });
    this.timer = setInterval(() => void this.dispatch(), 300);
    this.timer.unref();
    return true;
  }

  public async enqueue(payload: IncomingPayload): Promise<'QUEUED' | 'DUPLICATE' | 'UNAVAILABLE'> {
    const db = store.getDatabaseClient();
    if (!db) return 'UNAVAILABLE';
    try {
      await db.incomingMessageJob.create({ data: payload });
      void this.dispatch();
      return 'QUEUED';
    } catch (error: any) {
      if (error?.code === 'P2002' && payload.waMessageId) return 'DUPLICATE';
      console.error('No se pudo persistir mensaje entrante en la cola:', error);
      return 'UNAVAILABLE';
    }
  }

  public async getStats() {
    const db = store.getDatabaseClient();
    if (!db) return { persistent: false, pending: null, processing: this.active, failed: null };
    const [pending, processing, failed] = await Promise.all([
      db.incomingMessageJob.count({ where: { status: 'PENDING' } }),
      db.incomingMessageJob.count({ where: { status: 'PROCESSING' } }),
      db.incomingMessageJob.count({ where: { status: 'FAILED' } }),
    ]);
    return { persistent: true, pending, processing, failed };
  }

  private async claimNext(): Promise<QueueJob | null> {
    const db = store.getDatabaseClient();
    if (!db) return null;
    return db.$transaction(async (tx) => {
      // Serializa solo la selección del trabajo; el procesamiento ocurre fuera
      // de la transacción y no retiene conexiones durante llamadas a WhatsApp.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(721904221)`;
      const rows = await tx.$queryRaw<QueueJob[]>`
        SELECT q.id, q.phone, q.text, q."senderName", q."waMessageId", q."sourceChannel", q.attempts
        FROM cola_mensajes_entrantes q
        WHERE q.status = 'PENDING' AND q."availableAt" <= NOW()
          AND NOT EXISTS (
            SELECT 1 FROM cola_mensajes_entrantes active
            WHERE active.phone = q.phone AND active.status = 'PROCESSING'
          )
        ORDER BY q."createdAt" ASC
        LIMIT 1 FOR UPDATE SKIP LOCKED
      `;
      const job = rows[0];
      if (!job) return null;
      await tx.incomingMessageJob.update({
        where: { id: job.id },
        data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } },
      });
      return { ...job, attempts: job.attempts + 1 };
    }, { maxWait: 5000, timeout: 10000 });
  }

  private async dispatch() {
    if (this.polling || !this.handler || !store.getDatabaseClient()) return;
    this.polling = true;
    try {
      while (this.active < this.concurrency) {
        const job = await this.claimNext();
        if (!job) break;
        this.active += 1;
        void this.process(job).finally(() => {
          this.active -= 1;
          void this.dispatch();
        });
      }
    } catch (error) {
      console.error('Error reclamando mensajes de la cola persistente:', error);
    } finally {
      this.polling = false;
    }
  }

  private async process(job: QueueJob) {
    const db = store.getDatabaseClient();
    if (!db || !this.handler) return;
    try {
      await this.handler(job);
      await db.incomingMessageJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', processedAt: new Date(), lockedAt: null, lastError: null },
      });
    } catch (error: any) {
      const permanent = error?.code === 'P2002';
      const exhausted = job.attempts >= this.maxAttempts;
      const failed = permanent || exhausted;
      const delayMs = Math.min(60_000, 1000 * (2 ** Math.max(0, job.attempts - 1)));
      await db.incomingMessageJob.update({
        where: { id: job.id },
        data: {
          status: failed ? 'FAILED' : 'PENDING',
          availableAt: new Date(Date.now() + delayMs),
          lockedAt: null,
          lastError: String(error?.message || error).slice(0, 4000),
        },
      }).catch((updateError) => console.error('No se pudo actualizar el estado del trabajo entrante:', updateError));
      console.error(`Fallo procesando mensaje entrante ${job.id} (intento ${job.attempts}/${this.maxAttempts}):`, error);
    }
  }
}

export const incomingMessageQueue = new IncomingMessageQueueService();
