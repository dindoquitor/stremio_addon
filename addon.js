const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
require("dotenv").config();
const cheerio = require("cheerio");

/**
 * @typedef {Object} MovieMeta
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string|null} poster
 * @property {string|null} background
 * @property {string} [posterShape]
 * @property {number} [imdbRating]
 * @property {number|null} [year]
 * @property {string} [description]
 * @property {string} [genres]
 * @property {string} [cast]
 * @property {string} [director]
 * @property {number} [runtime]
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
      imdbRating: movie.vote_average,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
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
      .map((actor) => actor.name)
      .join(", ");

    const director =
      credits.data.crew.find((member) => member.job === "Director")?.name ?? "Unknown";

    return {
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title,
      description: movie.overview,
      poster: getImageUrl(movie.poster_path),
      background: getImageUrl(movie.backdrop_path, "original"),
      genres: movie.genres.map((genre) => genre.name).join(", "),
      cast,
      director,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      runtime: movie.runtime,
      language: movie.original_language,
      country: movie.production_countries?.[0]?.name,
    };
  } catch (error) {
    handleApiError(error, "meta");
  }
});

// ─── Stream Handler ──────────────────────────────────────────────────────────

builder.defineStreamHandler(async ({ id }) => {
  try {
    const tmdbId = extractTmdbId(id);
    const movieCacheKey = `movie:${tmdbId}`;

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

    const searchQuery = encodeURIComponent(movieData.title.toLowerCase());
    const searchUrl = `https://moviebox.ng/?s=${searchQuery}`;

    /** @type {import("axios").AxiosResponse} */
    let searchRes;
    try {
      searchRes = await axios.get(searchUrl, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
    } catch (err) {
      console.warn(`[STREAM] Search failed for "${movieData.title}": ${err.message}`);
      return { streams: [] };
    }

    const $search = cheerio.load(searchRes.data);
    let moviePageUrl = null;

    $search("article").each((_, el) => {
      const title = $search(el).find("h2.entry-title").text().toLowerCase();
      const href = $search(el).find("a").attr("href");
      if (title.includes(movieData.title.toLowerCase()) && href?.includes("/movies/")) {
        moviePageUrl = href;
        return false;
      }
    });

    if (!moviePageUrl) {
      console.log(`[STREAM] No MovieBox page found for "${movieData.title}"`);
      return { streams: [] };
    }

    /** @type {import("axios").AxiosResponse} */
    let movieRes;
    try {
      movieRes = await axios.get(moviePageUrl, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
    } catch (err) {
      console.warn(`[STREAM] Movie page fetch failed for "${movieData.title}": ${err.message}`);
      return { streams: [] };
    }

    const $movie = cheerio.load(movieRes.data);
    const videoUrl = $movie("video.art-video").attr("src");

    if (!videoUrl || !videoUrl.startsWith("http")) {
      console.log(`[STREAM] No valid video source for "${movieData.title}"`);
      return { streams: [] };
    }

    return {
      streams: [
        {
          title: "Watch in HD (MovieBox)",
          url: videoUrl,
          behaviorHints: {
            notWebReady: false,
          },
        },
      ],
    };
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
