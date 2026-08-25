import { describe, expect, it } from "vitest";
import { classifyPlayerNews, mapPlayerNews } from "../ingestPlayerNews";

describe("classifyPlayerNews", () => {
  it("maps FPL's own status codes to categories", () => {
    expect(classifyPlayerNews("i")).toBe("injury");
    expect(classifyPlayerNews("s")).toBe("suspension");
    expect(classifyPlayerNews("u")).toBe("transfer");
    expect(classifyPlayerNews("d")).toBe("availability");
  });

  it("falls back to 'general' for an available player or an unrecognised code, never invented", () => {
    expect(classifyPlayerNews("a")).toBe("general");
    expect(classifyPlayerNews("")).toBe("general");
    expect(classifyPlayerNews("some-future-fpl-code")).toBe("general");
  });
});

describe("mapPlayerNews", () => {
  const base = { id: 200, status: "i" } as const;

  it("maps a real, current note to a NewsItem shape", () => {
    const result = mapPlayerNews({ ...base, news: "Groin injury - Unknown return date", news_added: "2026-07-23T12:01:23.272929Z" });
    expect(result).toEqual({
      externalId: "200-2026-07-23T12:01:23.272929Z",
      category: "injury",
      title: "Injury update",
      description: "Groin injury - Unknown return date",
      publishedAt: new Date("2026-07-23T12:01:23.272929Z"),
    });
  });

  it("returns null for an empty news string — no fabricated 'nothing to report' item", () => {
    expect(mapPlayerNews({ ...base, news: "", news_added: "2026-07-23T12:01:23.272929Z" })).toBeNull();
  });

  it("returns null for a whitespace-only news string", () => {
    expect(mapPlayerNews({ ...base, news: "   ", news_added: "2026-07-23T12:01:23.272929Z" })).toBeNull();
  });

  it("returns null when news is missing entirely", () => {
    expect(mapPlayerNews({ ...base, news: null, news_added: "2026-07-23T12:01:23.272929Z" })).toBeNull();
    expect(mapPlayerNews({ ...base, news: undefined, news_added: "2026-07-23T12:01:23.272929Z" })).toBeNull();
  });

  it("returns null when there's a note but no timestamp — never defaults to 'now'", () => {
    expect(mapPlayerNews({ ...base, news: "Groin injury", news_added: null })).toBeNull();
    expect(mapPlayerNews({ ...base, news: "Groin injury", news_added: undefined })).toBeNull();
  });

  it("returns null for a malformed timestamp rather than throwing or guessing a date", () => {
    expect(mapPlayerNews({ ...base, news: "Groin injury", news_added: "not-a-real-date" })).toBeNull();
  });

  it("classifies transfer/departure notes using the status code, not by reading the text", () => {
    const result = mapPlayerNews({
      id: 302,
      status: "u",
      news: "Has joined Paris Saint-Germain permanently",
      news_added: "2026-08-10T14:03:30.089007Z",
    });
    expect(result?.category).toBe("transfer");
    expect(result?.title).toBe("Transfer");
    expect(result?.description).toBe("Has joined Paris Saint-Germain permanently");
  });

  it("produces a distinct dedup key when the same player's note is updated (new news_added)", () => {
    const first = mapPlayerNews({ ...base, news: "Groin injury - Unknown return date", news_added: "2026-07-23T12:01:23.272929Z" });
    const updated = mapPlayerNews({ ...base, news: "Groin injury - 25% chance of playing", news_added: "2026-08-01T09:00:00.000000Z" });
    expect(first?.externalId).not.toBe(updated?.externalId);
  });

  it("produces the identical dedup key for the same unchanged note — safe to re-run", () => {
    const a = mapPlayerNews({ ...base, news: "Groin injury - Unknown return date", news_added: "2026-07-23T12:01:23.272929Z" });
    const b = mapPlayerNews({ ...base, news: "Groin injury - Unknown return date", news_added: "2026-07-23T12:01:23.272929Z" });
    expect(a?.externalId).toBe(b?.externalId);
  });
});
