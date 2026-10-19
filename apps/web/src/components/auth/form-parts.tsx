import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({ label, id, ...input }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className="h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] focus:border-lagoon focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}

export function Submit({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="h-11 w-full rounded-md bg-lagoon font-medium text-white transition-colors hover:bg-lagoon-deep disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-status-booked/40 bg-status-booked/10 px-3 py-2 text-sm text-ink"
    >
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-md border border-status-available/40 bg-status-available/10 px-3 py-2 text-sm text-ink"
    >
      {message}
    </p>
  );
}
