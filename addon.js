const { addonBuilder } = require('stremio-addon-sdk')
const axios = require('axios')
require('dotenv').config()

// Get TMDB API key from environment variables
const TMDB_API_KEY = process.env.TMDB_API_KEY

const manifest = {
    "id": "org.vidsrcaddon",
    "version": "1.0.0",
    "name": "Vidsrc Streams",
    "description": "Stream movies and TV shows from vidsrc.to",
    "types": ["movie", "series"],
    "catalogs": [
        {
            type: 'movie',
            id: 'vidsrc_movies',
            name: 'Vidsrc Movies',
            extra: [
                {
                    name: 'skip',
                    isRequired: false,
                },
            ],
        },
        {
            type: 'series',
            id: 'vidsrc_series',
            name: 'Vidsrc TV Shows',
            extra: [
                {
                    name: 'skip',
                    isRequired: false,
                },
            ],
        }
    ],
    "resources": ["catalog", "stream"],
    "idPrefixes": ["tt", "tmdb:"]
}

const builder = new addonBuilder(manifest)

// Stream handler for both movies and TV shows
builder.defineStreamHandler(async ({ type, id, season, episode }) => {
    console.log(`Stream request - Type: ${type}, ID: ${id}, Season: ${season}, Episode: ${episode}`)
    
    // Clean TMDB ID if present
    const cleanedId = id.startsWith('tmdb:') ? id.substring(5) : id
    
    if (type === 'movie') {
        return {
            streams: [{
                title: 'Watch Movie',
                url: `https://vidsrc.xyz/embed/movie/${cleanedId}`,
                behaviorHints: {
                    notWebReady: true,
                }
            }]
        }
    } else if (type === 'series' && season && episode) {
        return {
            streams: [{
                title: `Watch S${season}E${episode}`,
                url: `https://vidsrc.xyz/embed/tv/${cleanedId}/${season}/${episode}`,
                behaviorHints: {
                    notWebReady: true,
                }
            }]
        }
    }

    return { streams: [] }
})

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`Catalog request - Type: ${type}, ID: ${id}, Extra:`, extra)

    const page = extra.skip ? Math.floor(extra.skip / 20) + 1 : 1

    let url
    if (type === 'movie') {
        url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${page}`
    } else if (type === 'series') {
        url = `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&page=${page}`
    }

    try {
        const response = await axios.get(url)
        const metas = response.data.results.map(item => ({
            id: `tmdb:${item.id}`,
            type: type,
            name: item.title || item.name,
            poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            background: `https://image.tmdb.org/t/p/original${item.backdrop_path}`,
            posterShape: 'regular',
            imdbRating: item.vote_average,
            year: new Date(item.release_date || item.first_air_date).getFullYear(),
            description: item.overview,
        }))

        return { metas }
    } catch (error) {
        console.error('Error fetching catalog:', error)
        return { metas: [] }
    }
})

module.exports = builder.getInterface()