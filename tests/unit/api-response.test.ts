import { describe, it, expect } from "vitest";
import { readApiResponse } from "@/lib/api/response";

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("readApiResponse", () => {
  it("returns parsed data for a successful JSON response", async () => {
    const r = await readApiResponse<{ documents: unknown[] }>(jsonRes(200, { documents: [] }));
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.error).toBeNull();
    expect(r.data?.documents).toEqual([]);
  });

  it("surfaces the API error message on failure", async () => {
    const r = await readApiResponse(jsonRes(403, { error: "You do not have permission" }));
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error).toBe("You do not have permission");
  });

  it("never throws on an HTML body (e.g. a redirect to the login page)", async () => {
    const html = new Response("<!DOCTYPE html><html><body>Sign in</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    const r = await readApiResponse(html);
    expect(r.ok).toBe(true); // HTTP-wise it succeeded…
    expect(r.data).toBeNull();
    expect(r.error).toMatch(/Unexpected response/); // …but we refuse to treat it as data
  });

  it("produces a session-expired message for a non-JSON 401", async () => {
    const r = await readApiResponse(
      new Response("Unauthorized", { status: 401, headers: { "content-type": "text/plain" } })
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/session has expired/i);
  });

  it("handles malformed JSON without throwing", async () => {
    const bad = new Response("{not json", { status: 500, headers: { "content-type": "application/json" } });
    const r = await readApiResponse(bad);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Request failed (500)");
  });
});
