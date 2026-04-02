import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safely serialize objects with BigInt fields to JSON-compatible form */
export function serializeBigInt<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
  ));
}
