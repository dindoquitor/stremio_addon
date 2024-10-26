const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
require("dotenv").config();

// Configuration constants
const CONFIG = {
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_BASE_URL: "https://api.themoviedb.org/3",
  IMAGE_BASE_URL: "https://image.tmdb.org/t/p",
  ITEMS_PER_PAGE: 20,
  MAX_CAST_MEMBERS: 5,
  DEFAULT_LANGUAGE: "tl",
};

// Validate environment variables
if (!CONFIG.TMDB_API_KEY) {
  throw new Error("TMDB_API_KEY environment variable is required");
}

// Create axios instance with default configuration
const tmdbClient = axios.create({
  baseURL: CONFIG.TMDB_BASE_URL,
  params: {
    api_key: CONFIG.TMDB_API_KEY,
    language: CONFIG.DEFAULT_LANGUAGE,
  },
  timeout: 10000, // 10 second timeout
});

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
  resources: ["catalog", "meta"],
  idPrefixes: ["tmdb"],
  logo: "https://res.cloudinary.com/dlvr5hpzp/image/upload/v1729859442/Vivamax_app_icon_mfsyys.jpg",
};

// Helper functions
const getImageUrl = (path, size = "w500") =>
  path ? `${CONFIG.IMAGE_BASE_URL}/${size}${path}` : null;

const extractTmdbId = (id) => {
  const match = id.match(/^tmdb:(\d+)$/);
  if (!match) throw new Error(`Invalid TMDB ID format: ${id}`);
  return match[1];
};

const handleApiError = (error, context) => {
  const errorDetails = {
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    status: error.response?.status,
    data: error.response?.data,
  };

  console.error(JSON.stringify(errorDetails));

  if (error.response?.status === 429) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  throw new Error(`Error in ${context}: ${error.message}`);
};

// Create addon builder
const builder = new addonBuilder(manifest);

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  try {
    const page = extra.skip
      ? Math.floor(extra.skip / CONFIG.ITEMS_PER_PAGE) + 1
      : 1;

    const { data } = await tmdbClient.get("/discover/movie", {
      params: {
        page,
        sort_by: "popularity.desc",
        with_original_language: CONFIG.DEFAULT_LANGUAGE,
      },
    });

    const metas = data.results.map((movie) => ({
      id: `tmdb:${movie.id}`,
      type: "movie",
      name: movie.title,
      poster: getImageUrl(movie.poster_path),
      background: getImageUrl(movie.backdrop_path, "original"),
      posterShape: "regular",
      imdbRating: movie.vote_average,
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : null,
      description: movie.overview,
    }));

    return { metas };
  } catch (error) {
    handleApiError(error, "catalog");
  }
});

// Meta handler
builder.defineMetaHandler(async ({ id }) => {
  try {
    const tmdbId = extractTmdbId(id);

    const [movieDetails, credits] = await Promise.all([
      tmdbClient.get(`/movie/${tmdbId}`),
      tmdbClient.get(`/movie/${tmdbId}/credits`),
    ]);

    const movie = movieDetails.data;
    const cast = credits.data.cast
      .slice(0, CONFIG.MAX_CAST_MEMBERS)
      .map((actor) => actor.name)
      .join(", ");

    const director =
      credits.data.crew.find((member) => member.job === "Director")?.name ??
      "Unknown";

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
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : null,
      runtime: movie.runtime,
      language: movie.original_language,
      country: movie.production_countries?.[0]?.name,
    };
  } catch (error) {
    handleApiError(error, "meta");
  }
});

// Error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

module.exports = builder.getInterface();
