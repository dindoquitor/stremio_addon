// const { addonBuilder } = require("stremio-addon-sdk");
// const axios = require("axios");
// require("dotenv").config();

// // Get TMDB API key from environment variables
// const TMDB_API_KEY = process.env.TMDB_API_KEY;

// // Define the addon manifest for Filipino movies
// const manifest = {
//   id: "org.filipinomoviesaddon",
//   version: "1.0.0",
//   name: "Pinoy Movies",
//   description: "Listahan ng mga Pinoy Movies.",
//   types: ["movie"],
//   catalogs: [
//     {
//       type: "movie",
//       id: "filipino_movies",
//       name: "Latest Pinoy Movies",
//       extra: [{ name: "skip", isRequired: false }],
//     },
//   ],
//   resources: ["catalog", "stream", "meta"], // Added "meta" resource
//   idPrefixes: ["tmdb"],
//   logo: "https://res.cloudinary.com/dlvr5hpzp/image/upload/v1729859442/Vivamax_app_icon_mfsyys.jpg", // Replace with your logo URL
// };

// const builder = new addonBuilder(manifest);

// // Catalog handler to fetch the latest Filipino movies from TMDB
// builder.defineCatalogHandler(async ({ type, id, extra }) => {
//   console.log(`Catalog request - Type: ${type}, ID: ${id}, Extra:`, extra);

//   const page = extra.skip ? Math.floor(extra.skip / 20) + 1 : 1;

//   // Fetch the latest Filipino movies from TMDB
//   const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=tl&page=${page}&sort_by=popularity.desc&with_original_language=tl`;

//   try {
//     const response = await axios.get(url);
//     const movies = response.data.results;

//     // Format TMDB data to Stremio catalog metadata
//     const metas = movies.map((movie) => ({
//       id: `tmdb:${movie.id}`,
//       type: "movie",
//       name: movie.title,
//       poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
//       background: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
//       posterShape: "regular",
//       imdbRating: movie.vote_average,
//       year: new Date(movie.release_date).getFullYear(),
//       description: movie.overview,
//     }));

//     return { metas };
//   } catch (error) {
//     console.error("Error fetching catalog:", error);
//     return { metas: [] };
//   }
// });

// // New metadata handler to fetch detailed movie information
// builder.defineMetaHandler(async ({ id }) => {
//   console.log(`Meta request for ID: ${id}`);

//   // Extract TMDB ID for fetching details
//   const cleanedId = id.startsWith("tmdb:") ? id.substring(5) : id;

//   // Fetch movie details from TMDB
//   const url = `https://api.themoviedb.org/3/movie/${cleanedId}?api_key=${TMDB_API_KEY}&language=tl`;

//   try {
//     const response = await axios.get(url);
//     const movie = response.data;

//     // Construct and return detailed metadata
//     return {
//       id: `tmdb:${movie.id}`,
//       type: "movie",
//       name: movie.title,
//       description: movie.overview,
//       poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
//       background: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
//       genres: movie.genres.map((genre) => genre.name).join(", "), // Join genres as a string
//       cast: await fetchCast(movie.id), // Fetch cast information
//       director: await fetchDirector(movie.id), // Fetch director information
//       year: new Date(movie.release_date).getFullYear(),
//     };
//   } catch (error) {
//     console.error("Error fetching movie details:", error);
//     return null; // Return null if an error occurs
//   }
// });

// // Helper function to fetch cast information
// async function fetchCast(movieId) {
//   const url = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=tl`;
//   try {
//     const response = await axios.get(url);
//     return response.data.cast
//       .slice(0, 5)
//       .map((actor) => actor.name)
//       .join(", "); // Return top 5 cast members
//   } catch (error) {
//     console.error("Error fetching cast:", error);
//     return "Unknown"; // Fallback in case of error
//   }
// }

// // Helper function to fetch director information
// async function fetchDirector(movieId) {
//   const url = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=tl`;
//   try {
//     const response = await axios.get(url);
//     const director = response.data.crew.find(
//       (member) => member.job === "Director"
//     );
//     return director ? director.name : "Unknown"; // Return director's name or unknown
//   } catch (error) {
//     console.error("Error fetching director:", error);
//     return "Unknown"; // Fallback in case of error
//   }
// }

// // Stream handler to provide external stream links
// builder.defineStreamHandler(async ({ type, id }) => {
//   console.log(`Stream request - Type: ${type}, ID: ${id}`);

//   // Extract TMDB ID for external link generation
//   const cleanedId = id.startsWith("tmdb:") ? id.substring(5) : id;

//   // Provide a stream with `notWebReady` hint
//   return {
//     streams: [
//       {
//         title: "Watch on External Source",
//         url: `https://vidsrc.to/embed/movie/${cleanedId}`,
//         behaviorHints: {
//           notWebReady: true, // Opens in an external browser
//         },
//       },
//     ],
//   };
// });

// module.exports = builder.getInterface(); // Added missing semicolon here

// const { addonBuilder } = require("stremio-addon-sdk");
// const axios = require("axios");
// require("dotenv").config();

// // Configuration constants
// const CONFIG = {
//   TMDB_API_KEY: process.env.TMDB_API_KEY,
//   TMDB_BASE_URL: "https://api.themoviedb.org/3",
//   IMAGE_BASE_URL: "https://image.tmdb.org/t/p",
//   ITEMS_PER_PAGE: 20,
//   MAX_CAST_MEMBERS: 5,
//   DEFAULT_LANGUAGE: "tl",
// };

// // Validate environment variables
// if (!CONFIG.TMDB_API_KEY) {
//   throw new Error("TMDB_API_KEY environment variable is required");
// }

// // Create axios instance with default configuration
// const tmdbClient = axios.create({
//   baseURL: CONFIG.TMDB_BASE_URL,
//   params: {
//     api_key: CONFIG.TMDB_API_KEY,
//     language: CONFIG.DEFAULT_LANGUAGE,
//   },
//   timeout: 10000, // 10 second timeout
// });

// const manifest = {
//   id: "org.filipinomoviesaddon",
//   version: "1.0.0",
//   name: "Pinoy Movies",
//   description: "Listahan ng mga Pinoy Movies.",
//   types: ["movie"],
//   catalogs: [
//     {
//       type: "movie",
//       id: "filipino_movies",
//       name: "Latest Pinoy Movies",
//       extra: [{ name: "skip", isRequired: false }],
//     },
//   ],
//   resources: ["catalog", "stream", "meta"],
//   idPrefixes: ["tmdb"],
//   logo: "https://res.cloudinary.com/dlvr5hpzp/image/upload/v1729859442/Vivamax_app_icon_mfsyys.jpg",
// };

// // Helper functions
// const getImageUrl = (path, size = "w500") =>
//   path ? `${CONFIG.IMAGE_BASE_URL}/${size}${path}` : null;

// const extractTmdbId = (id) => {
//   const match = id.match(/^tmdb:(\d+)$/);
//   if (!match) throw new Error(`Invalid TMDB ID format: ${id}`);
//   return match[1];
// };

// const handleApiError = (error, context) => {
//   const errorDetails = {
//     message: error.message,
//     context,
//     timestamp: new Date().toISOString(),
//     status: error.response?.status,
//     data: error.response?.data,
//   };

//   console.error(JSON.stringify(errorDetails));

//   if (error.response?.status === 429) {
//     throw new Error("Rate limit exceeded. Please try again later.");
//   }

//   throw new Error(`Error in ${context}: ${error.message}`);
// };

// // Create addon builder
// const builder = new addonBuilder(manifest);

// // Catalog handler
// builder.defineCatalogHandler(async ({ type, id, extra }) => {
//   try {
//     const page = extra.skip
//       ? Math.floor(extra.skip / CONFIG.ITEMS_PER_PAGE) + 1
//       : 1;

//     const { data } = await tmdbClient.get("/discover/movie", {
//       params: {
//         page,
//         sort_by: "popularity.desc",
//         with_original_language: CONFIG.DEFAULT_LANGUAGE,
//       },
//     });

//     const metas = data.results.map((movie) => ({
//       id: `tmdb:${movie.id}`,
//       type: "movie",
//       name: movie.title,
//       poster: getImageUrl(movie.poster_path),
//       background: getImageUrl(movie.backdrop_path, "original"),
//       posterShape: "regular",
//       imdbRating: movie.vote_average,
//       year: movie.release_date
//         ? new Date(movie.release_date).getFullYear()
//         : null,
//       description: movie.overview,
//     }));

//     return { metas };
//   } catch (error) {
//     handleApiError(error, "catalog");
//   }
// });

// // Meta handler
// builder.defineMetaHandler(async ({ id }) => {
//   try {
//     const tmdbId = extractTmdbId(id);

//     const [movieDetails, credits] = await Promise.all([
//       tmdbClient.get(`/movie/${tmdbId}`),
//       tmdbClient.get(`/movie/${tmdbId}/credits`),
//     ]);

//     const movie = movieDetails.data;
//     const cast = credits.data.cast
//       .slice(0, CONFIG.MAX_CAST_MEMBERS)
//       .map((actor) => actor.name)
//       .join(", ");

//     const director =
//       credits.data.crew.find((member) => member.job === "Director")?.name ??
//       "Unknown";

//     return {
//       id: `tmdb:${movie.id}`,
//       type: "movie",
//       name: movie.title,
//       description: movie.overview,
//       poster: getImageUrl(movie.poster_path),
//       background: getImageUrl(movie.backdrop_path, "original"),
//       genres: movie.genres.map((genre) => genre.name).join(", "),
//       cast,
//       director,
//       year: movie.release_date
//         ? new Date(movie.release_date).getFullYear()
//         : null,
//       runtime: movie.runtime,
//       language: movie.original_language,
//       country: movie.production_countries?.[0]?.name,
//     };
//   } catch (error) {
//     handleApiError(error, "meta");
//   }
// });

// // Stream handler
// builder.defineStreamHandler(async ({ type, id }) => {
//   try {
//     const tmdbId = extractTmdbId(id);

//     return {
//       streams: [
//         {
//           title: "Watch on External Source",
//           url: `https://vidsrc.to/embed/movie/${tmdbId}`,
//           behaviorHints: {
//             notWebReady: true,
//           },
//         },
//       ],
//     };
//   } catch (error) {
//     handleApiError(error, "stream");
//   }
// });

// // Error handling for uncaught exceptions
// process.on("uncaughtException", (error) => {
//   console.error("Uncaught Exception:", error);
//   process.exit(1);
// });

// process.on("unhandledRejection", (reason, promise) => {
//   console.error("Unhandled Rejection at:", promise, "reason:", reason);
//   process.exit(1);
// });

// module.exports = builder.getInterface();

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
