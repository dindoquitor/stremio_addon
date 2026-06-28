const {
  _test: { getImageUrl, extractTmdbId, validateSkip, cache, CONFIG },
} = require("../addon");

describe("getImageUrl", () => {
  test("returns full URL when path is provided", () => {
    const url = getImageUrl("/abc123.jpg");
    expect(url).toBe(`${CONFIG.IMAGE_BASE_URL}/w500/abc123.jpg`);
  });

  test("respects custom size parameter", () => {
    const url = getImageUrl("/abc.jpg", "original");
    expect(url).toBe(`${CONFIG.IMAGE_BASE_URL}/original/abc.jpg`);
  });

  test("returns null when path is null", () => {
    expect(getImageUrl(null)).toBeNull();
  });

  test("returns null when path is undefined", () => {
    expect(getImageUrl(undefined)).toBeNull();
  });
});

describe("extractTmdbId", () => {
  test("extracts numeric ID from valid tmdb:id string", () => {
    expect(extractTmdbId("tmdb:12345")).toBe("12345");
    expect(extractTmdbId("tmdb:999999")).toBe("999999");
  });

  test("throws on invalid format", () => {
    expect(() => extractTmdbId("tt12345")).toThrow("Invalid TMDB ID format");
    expect(() => extractTmdbId("12345")).toThrow("Invalid TMDB ID format");
    expect(() => extractTmdbId("tmdb:")).toThrow("Invalid TMDB ID format");
    expect(() => extractTmdbId("tmdb:abc")).toThrow("Invalid TMDB ID format");
  });

  test("throws on non-string input", () => {
    expect(() => extractTmdbId(null)).toThrow("Invalid ID");
    expect(() => extractTmdbId(undefined)).toThrow("Invalid ID");
    expect(() => extractTmdbId(123)).toThrow("Invalid ID");
  });
});

describe("validateSkip", () => {
  test("returns 0 for undefined or null", () => {
    expect(validateSkip(undefined)).toBe(0);
    expect(validateSkip(null)).toBe(0);
  });

  test("parses string numbers", () => {
    expect(validateSkip("20")).toBe(20);
    expect(validateSkip("0")).toBe(0);
  });

  test("returns 0 for negative numbers", () => {
    expect(validateSkip(-1)).toBe(0);
    expect(validateSkip("-5")).toBe(0);
  });

  test("returns 0 for non-numeric strings", () => {
    expect(validateSkip("abc")).toBe(0);
  });

  test("returns integer value", () => {
    expect(validateSkip(40)).toBe(40);
  });
});

describe("TTLCache", () => {
  beforeEach(() => {
    cache.clear();
  });

  test("stores and retrieves values", () => {
    cache.set("key1", { foo: "bar" });
    expect(cache.get("key1")).toEqual({ foo: "bar" });
  });

  test("returns undefined for missing keys", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  test("respects custom TTL", async () => {
    cache.set("short", "value", 10); // 10ms TTL
    expect(cache.get("short")).toBe("value");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(cache.get("short")).toBeUndefined();
  });

  test("clear removes all entries", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });
});

describe("CONFIG", () => {
  test("has required keys", () => {
    expect(CONFIG.TMDB_API_KEY).toBeDefined();
    expect(typeof CONFIG.TMDB_API_KEY).toBe("string");
    expect(CONFIG.TMDB_BASE_URL).toBe("https://api.themoviedb.org/3");
    expect(CONFIG.IMAGE_BASE_URL).toBe("https://image.tmdb.org/t/p");
    expect(CONFIG.ITEMS_PER_PAGE).toBe(20);
    expect(CONFIG.MAX_CAST_MEMBERS).toBe(5);
    expect(CONFIG.DEFAULT_LANGUAGE).toBe("tl");
  });

  test("has cache TTL values", () => {
    expect(CONFIG.CACHE_TTL.CATALOG).toBeGreaterThan(0);
    expect(CONFIG.CACHE_TTL.MOVIE_DETAILS).toBeGreaterThan(0);
    expect(CONFIG.CACHE_TTL.CREDITS).toBeGreaterThan(0);
  });

  test("has retry configuration", () => {
    expect(CONFIG.RETRY.MAX_RETRIES).toBeGreaterThan(0);
    expect(CONFIG.RETRY.BASE_DELAY_MS).toBeGreaterThan(0);
  });
});
