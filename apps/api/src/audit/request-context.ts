import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditRequestContext {
  actorId?: string | null;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<AuditRequestContext>();

export function runWithAuditContext<T>(ctx: AuditRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getAuditContext(): AuditRequestContext | undefined {
  return storage.getStore();
}

export function setAuditActor(actorId: string | null | undefined) {
  const store = storage.getStore();
  if (store) {
    store.actorId = actorId ?? null;
  }
}
