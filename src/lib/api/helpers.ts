import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { HttpError } from "@/services/documents";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof HttpError) return jsonError(err.status, err.message);
  if (err instanceof ZodError) return jsonError(400, err.issues[0]?.message ?? "Invalid request");
  console.error("[api] unexpected error", err);
  return jsonError(500, "Internal server error");
}

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(body);
}
