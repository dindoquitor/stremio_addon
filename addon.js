const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
require("dotenv").config();

/**
 * @typedef {Object} MovieMeta
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string|null} poster
 * @property {string|null} background
 * @property {string} [posterShape]
 * @property {string} [imdbRating]
 * @property {string} [releaseInfo]
 * @property {string} [description]
 * @property {string[]} [genres]
 * @property {string[]} [cast]
 * @property {string[]} [director]
 * @property {string} [runtime]
 * @property {string} [language]
 * @property {string} [country]
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_BASE_URL: "https://api.themoviedb.org/3",
  IMAGE_BASE_URL: "https://image.tmdb.org/t/p",
  ITEMS_PER_PAGE: 20,
  MAX_CAST_MEMBERS: 5,
  DEFAULT_LANGUAGE: "tl",
  CACHE_TTL: {
    CATALOG: 5 * 60 * 1000, // 5 minutes
    MOVIE_DETAILS: 60 * 60 * 1000, // 1 hour
    CREDITS: 60 * 60 * 1000, // 1 hour
  },
  RETRY: {
    MAX_RETRIES: 3,
    BASE_DELAY_MS: 1000,
  },
  REQUEST_TIMEOUT: 10000,
};

if (!CONFIG.TMDB_API_KEY) {
  throw new Error("TMDB_API_KEY environment variable is required");
}

// ─── TTL Cache ───────────────────────────────────────────────────────────────

class TTLCache {
  /**
   * @param {number} [defaultTtlMs=300000] Default TTL in milliseconds (5 min)
   */
  constructor(defaultTtlMs = 300000) {
    /** @type {Map<string, {value: unknown, expiry: number}>} */
    this._store = new Map();
    this._defaultTtl = defaultTtlMs;
  }

  /**
   * Retrieve a cached value, returning undefined if missing or expired.
   * @param {string} key
   * @returns {unknown|undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value with an optional TTL override.
   * @param {string} key
   * @param {unknown} value
   * @param {number} [ttlMs]
   */
  set(key, value, ttlMs) {
    this._store.set(key, {
      value,
      expiry: Date.now() + (ttlMs || this._defaultTtl),
    });
  }

  /** Remove all entries. */
  clear() {
    this._store.clear();
  }
}

/** @type {TTLCache} */
const cache = new TTLCache();

// ─── Retry Utility ───────────────────────────────────────────────────────────

/**
 * Retry an async function with exponential backoff.
 * Only retries on transient errors (rate limits, network, 5xx server errors).
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{maxRetries?: number, baseDelay?: number, context?: string}} [options]
 * @returns {Promise<T>}
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = CONFIG.RETRY.MAX_RETRIES,
    baseDelay = CONFIG.RETRY.BASE_DELAY_MS,
    context = "operation",
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- retry loop requires sequential awaits
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable =
        error.response?.status === 429 ||
        (error.response?.status != null && error.response.status >= 500) ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED";

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[RETRY] ${context} - attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      // eslint-disable-next-line no-await-in-loop -- intentional backoff delay
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ─── Axios Instance ──────────────────────────────────────────────────────────

const tmdbClient = axios.create({
  baseURL: CONFIG.TMDB_BASE_URL,
  params: {
    api_key: CONFIG.TMDB_API_KEY,
    language: CONFIG.DEFAULT_LANGUAGE,
  },
  timeout: CONFIG.REQUEST_TIMEOUT,
});

// ─── Manifest ────────────────────────────────────────────────────────────────

const manifest = {
  id: "org.filipinomoviesaddon",
  version: "1.0.0",
  name: "Pinoy Movies",
  description: "Listahan ng mga Pinoy Movies.",
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "filipino_movies",
      name: "Latest Pinoy Movies",
      extra: [{ name: "skip", isRequired: false }],
    },
  ],
  resources: ["catalog", "meta", "stream"],
  idPrefixes: ["tmdb"],
  logo: "https://res.cloudinary.com/dlvr5hpzp/image/upload/v1729859442/Vivamax_app_icon_mfsyys.jpg",
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Build a full TMDB image URL, or null if no path provided.
 * @param {string|null} path
 * @param {string} [size="w500"]
 * @returns {string|null}
 */
const getImageUrl = (path, size = "w500") =>
  path ? `${CONFIG.IMAGE_BASE_URL}/${size}${path}` : null;

/**
 * Extract numeric TMDB ID from a "tmdb:{id}" string.
 * @param {string} id
 * @returns {string} The numeric TMDB ID
 * @throws {Error} If the ID format is invalid
 */
const extractTmdbId = (id) => {
  if (!id || typeof id !== "string") {
    throw new Error(`Invalid ID: expected string, got ${typeof id}`);
  }
  const match = id.match(/^tmdb:(\d+)$/);
  if (!match) throw new Error(`Invalid TMDB ID format: ${id}`);
  return match[1];
};

/**
 * Validate and sanitize the skip parameter for pagination.
 * @param {string|number|undefined|null} skip
 * @returns {number} A non-negative integer
 */
const validateSkip = (skip) => {
  if (skip === undefined || skip === null) return 0;
  const num = Number(skip);
  if (!Number.isInteger(num) || num < 0) return 0;
  return num;
};

/**
 * Log structured error details for API failures.
 * @param {Error & {response?: {status?: number, data?: unknown}}} error
 * @param {string} context
 */
const logApiError = (error, context) => {
  console.error(
    JSON.stringify({
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      status: error.response?.status,
      data: error.response?.data,
    })
  );
};

/**
 * Handle API errors consistently across handlers.
 * @param {Error & {response?: {status?: number, data?: unknown}}} error
 * @param {string} context
 * @throws {Error}
 */
const handleApiError = (error, context) => {
  logApiError(error, context);

  if (error.response?.status === 429) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  throw new Error(`Error in ${context}: ${error.message}`);
};

// ─── Addon Builder ───────────────────────────────────────────────────────────

const builder = new addonBuilder(manifest);

// ─── Catalog Handler ────────────────────────────────────────────────────────

builder.defineCatalogHandler(async ({ type: _type, id: _id, extra = {} }) => {
  try {
    const skip = validateSkip(extra.skip);
    const page = Math.floor(skip / CONFIG.ITEMS_PER_PAGE) + 1;
    const cacheKey = `catalog:${page}`;

    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const { data } = await withRetry(
      () =>
        tmdbClient.get("/discover/movie", {
          params: {
            page,
            sort_by: "popularity.desc",
            with_original_language: CONFIG.DEFAULT_LANGUAGE,
          },
        }),
      { context: "catalog" }
    );

    /** @type {MovieMeta[]} */
    const metas = data.results.map((movie) => ({
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title,
      poster: getImageUrl(movie.poster_path),
      background: getImageUrl(movie.backdrop_path, "original"),
      posterShape: "regular",
      imdbRating: movie.vote_average != null ? String(movie.vote_average) : undefined,
      releaseInfo: movie.release_date
        ? String(new Date(movie.release_date).getFullYear())
        : undefined,
      description: movie.overview,
    }));

    const result = { metas };
    cache.set(cacheKey, result, CONFIG.CACHE_TTL.CATALOG);
    return result;
  } catch (error) {
    handleApiError(error, "catalog");
  }
});

// ─── Meta Handler ────────────────────────────────────────────────────────────

builder.defineMetaHandler(async ({ id }) => {
  try {
    const tmdbId = extractTmdbId(id);
    const detailsCacheKey = `movie:${tmdbId}`;
    const creditsCacheKey = `credits:${tmdbId}`;

    const [movieDetails, credits] = await Promise.all([
      (async () => {
        const cached = cache.get(detailsCacheKey);
        if (cached) return cached;
        const res = await withRetry(() => tmdbClient.get(`/movie/${tmdbId}`), {
          context: `movie/${tmdbId}`,
        });
        cache.set(detailsCacheKey, res, CONFIG.CACHE_TTL.MOVIE_DETAILS);
        return res;
      })(),
      (async () => {
        const cached = cache.get(creditsCacheKey);
        if (cached) return cached;
        const res = await withRetry(() => tmdbClient.get(`/movie/${tmdbId}/credits`), {
          context: `credits/${tmdbId}`,
        });
        cache.set(creditsCacheKey, res, CONFIG.CACHE_TTL.CREDITS);
        return res;
      })(),
    ]);

    const movie = movieDetails.data;
    const cast = credits.data.cast
      .slice(0, CONFIG.MAX_CAST_MEMBERS)
      .map((actor) => actor.name);

    const director =
      credits.data.crew.find((member) => member.job === "Director")?.name ?? "Unknown";

    /** @type {import("./addon").MovieMeta} */
    const metaObj = {
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title,
      description: movie.overview,
      poster: getImageUrl(movie.poster_path),
      background: getImageUrl(movie.backdrop_path, "original"),
      genres: movie.genres.map((genre) => genre.name),
      cast,
      director: [director],
      releaseInfo: movie.release_date
        ? String(new Date(movie.release_date).getFullYear())
        : undefined,
      runtime: movie.runtime ? `${movie.runtime}m` : undefined,
      imdbRating: movie.vote_average != null ? String(movie.vote_average) : undefined,
      language: movie.original_language,
      country: movie.production_countries?.[0]?.name,
    };

    return { meta: metaObj };
  } catch (error) {
    handleApiError(error, "meta");
  }
});

// ─── MovieBox API Configuration ───────────────────────────────────────────────

const MOVIEBOX = {
  API_BASE: "https://h5-api.aoneroom.com/wefeed-h5api-bff",
  SEARCH_URL: "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search",
  DOMAIN_URL: "https://h5-api.aoneroom.com/wefeed-h5api-bff/media-player/get-domain",
  DETAIL_BASE: "https://moviebox.ph/detail",
  HEADERS: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
  },
  PLAYER_HEADERS: {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "x-client-info": '{"timezone":"Asia/Manila"}',
    "x-source": "",
  },
  PLAYER_COOKIES: {
    uuid: "d8c3539e-2e46-4000-af20-7046a856e30a",
  },
  STREAM_CACHE_TTL: 30 * 60 * 1000, // 30 minutes
};

/**
 * Normalize a title for comparison: lowercase, remove punctuation and extra spaces.
 * @param {string} title
 * @returns {string}
 */
const normalizeTitle = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Check if two titles are a reasonable match.
 * @param {string} tmdbTitle
 * @param {string} mbTitle
 * @returns {boolean}
 */
const titlesMatch = (tmdbTitle, mbTitle) => {
  const a = normalizeTitle(tmdbTitle);
  const b = normalizeTitle(mbTitle);
  return a.includes(b) || b.includes(a);
};

// ─── Stream Handler ──────────────────────────────────────────────────────────

builder.defineStreamHandler(async ({ id }) => {
  try {
    const tmdbId = extractTmdbId(id);
    const movieCacheKey = `movie:${tmdbId}`;
    const streamCacheKey = `stream:${tmdbId}`;

    // Check stream cache first
    const cachedStreams = cache.get(streamCacheKey);
    if (cachedStreams) return cachedStreams;

    // Get TMDB movie data
    let movieData;
    const cached = cache.get(movieCacheKey);
    if (cached) {
      movieData = cached.data;
    } else {
      const res = await withRetry(() => tmdbClient.get(`/movie/${tmdbId}`), {
        context: `movie/${tmdbId}`,
      });
      cache.set(movieCacheKey, res, CONFIG.CACHE_TTL.MOVIE_DETAILS);
      movieData = res.data;
    }

    const movieTitle = movieData.title;

    // ── Step 1: Search MovieBox API for the movie ──────────────────────────
    console.log(`[STREAM] Searching MovieBox for: "${movieTitle}"`);
    let searchResults;
    try {
      const searchRes = await axios.post(
        MOVIEBOX.SEARCH_URL,
        { keyword: movieTitle, perPage: 10, page: 1 },
        { headers: MOVIEBOX.HEADERS, timeout: 15000 }
      );
      searchResults = searchRes.data?.data?.items || [];
    } catch (err) {
      console.warn(`[STREAM] MovieBox search failed: ${err.message}`);
      return { streams: [] };
    }

    if (!searchResults.length) {
      console.log(`[STREAM] No MovieBox results for "${movieTitle}"`);
      return { streams: [] };
    }

    // ── Step 2: Find the best matching result ─────────────────────────────
    let bestMatch = null;
    for (const item of searchResults) {
      const itemTitle = item.title || "";
      if (titlesMatch(movieTitle, itemTitle)) {
        bestMatch = item;
        break;
      }
    }
    // Fallback: use the first result if no title match
    if (!bestMatch) {
      bestMatch = searchResults[0];
      console.log(
        `[STREAM] No exact title match for "${movieTitle}", using: "${bestMatch.title}"`
      );
    }

    const subjectId = bestMatch.subjectId || bestMatch.id;
    const detailPath = bestMatch.detailPath;

    if (!subjectId || !detailPath) {
      console.log(`[STREAM] Missing subjectId or detailPath for "${movieTitle}"`);
      return { streams: [] };
    }

    console.log(
      `[STREAM] Matched: "${bestMatch.title}" (subjectId=${subjectId}, slug=${detailPath})`
    );

    // ── Step 3: Get the player CDN domain ─────────────────────────────────
    let streamDomain = "https://123movienow.cc"; // fallback
    try {
      const domainRes = await axios.get(MOVIEBOX.DOMAIN_URL, {
        headers: {
          "User-Agent": MOVIEBOX.HEADERS["User-Agent"],
          "X-Client-Info": '{"timezone":"Asia/Manila"}',
          "X-Client-Type": "h5",
          "X-App-Version": "1.0.0",
        },
        timeout: 10000,
      });
      if (domainRes.data?.data) {
        streamDomain = domainRes.data.data.replace(/\/$/, "");
      }
    } catch (err) {
      console.warn(`[STREAM] Could not fetch player domain, using fallback: ${err.message}`);
    }

    // ── Step 4: Fetch stream URLs from the player API ─────────────────────
    const playUrl =
      `${streamDomain}/wefeed-h5api-bff/subject/play` +
      `?subjectId=${subjectId}&se=0&ep=0&detailPath=${encodeURIComponent(detailPath)}`;

    const cookieString = Object.entries(MOVIEBOX.PLAYER_COOKIES)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const playRes = await axios.get(playUrl, {
      headers: {
        ...MOVIEBOX.PLAYER_HEADERS,
        Cookie: cookieString,
        referer:
          `${streamDomain}/spa/videoPlayPage/movies/${detailPath}` +
          `?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`,
      },
      timeout: 15000,
    });

    const streams = playRes.data?.data?.streams || [];
    if (!streams.length) {
      console.log(`[STREAM] No streams available for "${movieTitle}"`);
      return { streams: [] };
    }

    // ── Step 5: Build Stremio stream objects ──────────────────────────────
    const stremioStreams = streams
      .filter((s) => s.url && s.url.startsWith("http"))
      .map((s) => {
        const resolution = s.resolutions ? `${s.resolutions}p` : "";
        const format = s.format ? s.format.toUpperCase() : "";
        const label = [resolution, format, "(MovieBox)"].filter(Boolean).join(" ");
        return {
          title: label,
          url: s.url,
          behaviorHints: {
            notWebReady: s.format === "m3u8" || s.url.includes(".m3u8"),
          },
        };
      });

    if (!stremioStreams.length) {
      console.log(`[STREAM] No valid stream URLs for "${movieTitle}"`);
      return { streams: [] };
    }

    // Sort: highest resolution first
    stremioStreams.sort((a, b) => {
      const resA = parseInt(a.title.match(/(\d+)p/)?.[1] || "0", 10);
      const resB = parseInt(b.title.match(/(\d+)p/)?.[1] || "0", 10);
      return resB - resA;
    });

    console.log(
      `[STREAM] Found ${stremioStreams.length} stream(s) for "${movieTitle}":`,
      stremioStreams.map((s) => s.title).join(", ")
    );

    const result = { streams: stremioStreams };
    cache.set(streamCacheKey, result, MOVIEBOX.STREAM_CACHE_TTL);
    return result;
  } catch (error) {
    console.error(`[STREAM] Handler error: ${error.message}`);
    return { streams: [] };
  }
});

// ─── Process Error Handling ──────────────────────────────────────────────────

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error.message, error.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
});

// ─── Exports ─────────────────────────────────────────────────────────────────

const addonInterface = builder.getInterface();

addonInterface._test = {
  getImageUrl,
  extractTmdbId,
  validateSkip,
  cache,
  CONFIG,
};

module.exports = addonInterface;
