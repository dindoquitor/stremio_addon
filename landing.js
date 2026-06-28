/**
 * Generate the Netflix-style landing page HTML.
 * @param {string} baseUrl - The base URL of the addon (e.g. "http://localhost:7000")
 * @returns {string} Complete HTML page
 */
function getLandingPage(baseUrl) {
  const installLink = `stremio://addon?url=${encodeURIComponent(baseUrl + "/manifest.json")}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pinoy Movies — Stremio Addon</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0d0d0d;
      --bg-card: #1a1a1a;
      --bg-elevated: #222;
      --accent: #e5a00d;
      --accent-glow: rgba(229, 160, 13, 0.25);
      --text: #fff;
      --text-muted: #b3b3b3;
      --text-dim: #777;
      --radius: 8px;
      --radius-lg: 14px;
      --transition: 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* ── Nav ─────────────────────────────────── */
    .nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: 68px;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 4vw;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      transition: background var(--transition);
    }
    .nav.scrolled {
      background: rgba(13,13,13,0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .nav-logo {
      font-size: 1.7rem; font-weight: 800; letter-spacing: -0.5px;
      color: var(--accent); text-decoration: none;
      display: flex; align-items: center; gap: 10px;
    }
    .nav-logo span { color: var(--text); font-weight: 400; font-size: 0.85rem; opacity: 0.7; }

    .nav-actions { display: flex; gap: 16px; align-items: center; }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 22px; border-radius: var(--radius);
      font-size: 0.95rem; font-weight: 600; text-decoration: none;
      cursor: pointer; border: none; transition: all var(--transition);
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--accent); color: #000;
      box-shadow: 0 2px 12px var(--accent-glow);
    }
    .btn-primary:hover {
      background: #f5b730;
      transform: translateY(-1px);
      box-shadow: 0 6px 24px var(--accent-glow);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.1); color: var(--text);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.18);
      border-color: rgba(255,255,255,0.3);
    }

    /* ── Hero ────────────────────────────────── */
    .hero {
      position: relative; height: 85vh; min-height: 520px;
      display: flex; align-items: flex-end;
      padding: 0 4vw 8vh;
      background: var(--bg);
    }
    .hero-bg {
      position: absolute; inset: 0;
      background-size: cover; background-position: center top;
      transition: opacity 0.8s ease;
    }
    .hero-bg::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(0deg, var(--bg) 0%, transparent 50%, rgba(0,0,0,0.4) 100%),
                  linear-gradient(90deg, rgba(13,13,13,0.85) 0%, transparent 60%);
    }
    .hero-content { position: relative; z-index: 2; max-width: 600px; animation: fadeUp 0.9s ease; }
    .hero-tag { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 3px; color: var(--accent); margin-bottom: 12px; }
    .hero-title { font-size: clamp(2.2rem, 5vw, 3.8rem); font-weight: 800; line-height: 1.1; margin-bottom: 16px; }
    .hero-meta { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; color: var(--text-muted); font-size: 0.95rem; }
    .hero-rating { display: flex; align-items: center; gap: 6px; color: var(--accent); font-weight: 700; }
    .hero-rating svg { width: 18px; height: 18px; }
    .hero-desc { font-size: 0.95rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 14px;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* ── Toast ───────────────────────────────── */
    .toast {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px);
      background: var(--bg-elevated); color: var(--text);
      padding: 12px 28px; border-radius: 50px; font-size: 0.9rem; font-weight: 500;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5); z-index: 999;
      transition: transform var(--transition); pointer-events: none;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .toast.show { transform: translateX(-50%) translateY(0); }

    /* ── Catalog Section ─────────────────────── */
    .catalog-section { padding: 0 4vw 60px; }
    .catalog-header { margin-bottom: 28px; }
    .catalog-header h2 { font-size: 1.5rem; font-weight: 700; }
    .catalog-header p { color: var(--text-muted); margin-top: 6px; font-size: 0.9rem; }

    .movie-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
      gap: 20px;
    }

    .movie-card {
      position: relative; border-radius: var(--radius-lg); overflow: hidden;
      background: var(--bg-card); cursor: pointer; transition: all var(--transition);
    }
    .movie-card:hover {
      transform: scale(1.06); z-index: 10;
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
    }
    .movie-card:hover .card-overlay { opacity: 1; }

    .card-poster {
      width: 100%; aspect-ratio: 2/3; object-fit: cover;
      display: block; background: var(--bg-elevated);
    }
    .card-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 50%);
      opacity: 0; transition: opacity var(--transition);
      display: flex; align-items: flex-end; padding: 16px;
    }
    .card-info { width: 100%; }
    .card-title { font-size: 0.9rem; font-weight: 600; line-height: 1.2; margin-bottom: 6px; }
    .card-meta { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); }
    .card-rating { color: var(--accent); font-weight: 700; display: flex; align-items: center; gap: 3px; }
    .card-rating svg { width: 12px; height: 12px; }

    /* ── Skeleton Loaders ────────────────────── */
    .skeleton { border-radius: var(--radius-lg); background: var(--bg-elevated); position: relative; overflow: hidden; }
    .skeleton::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
      animation: shimmer 1.6s infinite;
      background-size: 200% 100%;
    }
    .skeleton-poster { width: 100%; aspect-ratio: 2/3; }
    .skeleton-title { height: 16px; width: 80%; margin-top: 12px; }

    /* ── Error State ─────────────────────────── */
    .error-state {
      display: none; text-align: center; padding: 60px 20px;
    }
    .error-state svg { width: 64px; height: 64px; color: var(--text-dim); margin-bottom: 16px; }
    .error-state h3 { font-size: 1.2rem; margin-bottom: 8px; }
    .error-state p { color: var(--text-muted); }
    .error-state .btn { margin-top: 20px; display: inline-flex; }

    /* ── Footer ──────────────────────────────── */
    .footer {
      padding: 40px 4vw; text-align: center;
      color: var(--text-dim); font-size: 0.82rem;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .footer a { color: var(--text-muted); text-decoration: underline; }

    /* ── Responsive ──────────────────────────── */
    @media (max-width: 768px) {
      .hero { height: 70vh; min-height: 420px; padding-bottom: 6vh; }
      .movie-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
      .nav-logo { font-size: 1.3rem; }
      .nav-actions { display: none; }
      .hero-actions { flex-direction: column; }
      .btn { width: 100%; justify-content: center; }
    }
    @media (max-width: 480px) {
      .hero { height: 60vh; min-height: 360px; }
      .movie-grid { grid-template-columns: repeat(auto-fill, minmax(115px, 1fr)); gap: 10px; }
      .nav-logo span { display: none; }
    }
  </style>
</head>
<body>

  <!-- Nav -->
  <nav class="nav" id="nav">
    <a class="nav-logo" href="/">&#127988; Pinoy Movies <span>Stremio Addon</span></a>
    <div class="nav-actions">
      <button class="btn btn-secondary" onclick="copyLink()" title="Copy manifest link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Link
      </button>
      <a class="btn btn-primary" href="${installLink}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm6 4v6.17l-2.59-2.58L7 12l5 5 5-5-1.41-1.41L13 13.17V7h-2z"/></svg>
        Install in Stremio
      </a>
    </div>
  </nav>

  <!-- Toast -->
  <div class="toast" id="toast">Link copied to clipboard!</div>

  <!-- Hero -->
  <section class="hero" id="hero">
    <div class="hero-bg" id="heroBg"></div>
    <div class="hero-content" id="heroContent">
      <div class="hero-tag">Now Playing</div>
      <div class="skeleton skeleton-title" style="height:48px;width:70%;margin-bottom:16px;"></div>
      <div class="skeleton" style="height:14px;width:40%;margin-bottom:18px;"></div>
      <div class="skeleton" style="height:14px;width:90%;margin-bottom:8px;"></div>
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:26px;"></div>
    </div>
  </section>

  <!-- Catalog -->
  <section class="catalog-section">
    <div class="catalog-header">
      <h2>Latest Pinoy Movies</h2>
      <p>Discover the newest Filipino films — install the addon and watch in Stremio.</p>
    </div>

    <!-- Error State -->
    <div class="error-state" id="errorState">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <h3>Could not load movies</h3>
      <p id="errorMsg">Please check your connection and try again.</p>
      <button class="btn btn-primary" onclick="loadMovies()">Try Again</button>
    </div>

    <!-- Skeleton Grid -->
    <div class="movie-grid" id="skeletonGrid">
      ${Array.from(
        { length: 10 },
        () =>
          `<div><div class="skeleton skeleton-poster"></div><div class="skeleton skeleton-title"></div></div>`
      ).join("")}
    </div>

    <!-- Actual Grid -->
    <div class="movie-grid" id="movieGrid" style="display:none;"></div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p>Powered by <a href="https://www.themoviedb.org/" target="_blank">TMDB</a> &middot;
    Built with <a href="https://github.com/Stremio/stremio-addon-sdk" target="_blank">Stremio Addon SDK</a></p>
  </footer>

  <script>
    const CATALOG_URL = "/catalog/movie/filipino_movies.json";
    const IMAGE_BASE = "https://image.tmdb.org/t/p";
    let allMovies = [];

    // ── Nav scroll effect ─────────────────────
    window.addEventListener("scroll", () => {
      document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 40);
    });

    // ── Copy link ─────────────────────────────
    function copyLink() {
      navigator.clipboard.writeText(window.location.origin + "/manifest.json").then(() => {
        const t = document.getElementById("toast");
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 2200);
      }).catch(() => {
        prompt("Copy this link:", window.location.origin + "/manifest.json");
      });
    }

    // ── Star SVG ──────────────────────────────
    const starSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

    // ── Build hero ────────────────────────────
    function buildHero(movie) {
      const bg = document.getElementById("heroBg");
      const content = document.getElementById("heroContent");
      const poster = movie.poster || movie.background;
      bg.style.backgroundImage = movie.background
        ? 'url(' + movie.background + ')'
        : 'url(' + IMAGE_BASE + '/original' + (movie.backdrop_path || '') + ')';

      const rating = movie.imdbRating != null ? Number(movie.imdbRating).toFixed(1) : "—";
      const year = movie.year || "";

      var genres = movie.genres || "";
      var desc = movie.description || "A must-watch Filipino film.";
      content.innerHTML = '' +
        '<div class="hero-tag">Now Playing</div>' +
        '<h1 class="hero-title">' + escapeHtml(movie.name) + '</h1>' +
        '<p class="hero-desc">' + escapeHtml(desc) + '</p>' +
        '<div class="hero-meta">' +
          '<span class="hero-rating">' + starSvg + ' ' + rating + '</span>' +
          (year ? '<span>' + year + '</span>' : '') +
          (genres ? '<span>' + escapeHtml(genres) + '</span>' : '') +
        '</div>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="${installLink}">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm6 4v6.17l-2.59-2.58L7 12l5 5 5-5-1.41-1.41L13 13.17V7h-2z"/></svg>' +
            'Install in Stremio' +
          '</a>' +
          '<button class="btn btn-secondary" onclick="copyLink()">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            'Copy Link' +
          '</button>' +
        '</div>';
    }

    function escapeHtml(text) {
      const d = document.createElement("div");
      d.textContent = text;
      return d.innerHTML;
    }

    // ── Build movie cards ─────────────────────
    function buildCard(movie) {
      var rating = movie.imdbRating != null ? Number(movie.imdbRating).toFixed(1) : "";
      var year = movie.year || "";
      var posterUrl = movie.poster || (IMAGE_BASE + '/w500' + (movie.poster_path || ''));
      var fallbackSvg = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">' +
        '<rect fill="#222" width="300" height="450"/>' +
        '<text fill="#555" x="150" y="230" text-anchor="middle" font-size="16">No Poster</text>' +
        '</svg>'
      );

      var card = document.createElement('div');
      card.className = 'movie-card';
      card.onclick = function () { window.open('${installLink}', '_self'); };

      var img = document.createElement('img');
      img.className = 'card-poster';
      img.src = posterUrl;
      img.alt = movie.name;
      img.loading = 'lazy';
      img.onerror = function () { this.src = fallbackSvg; this.onerror = null; };

      var overlay = document.createElement('div');
      overlay.className = 'card-overlay';

      var info = document.createElement('div');
      info.className = 'card-info';

      var titleEl = document.createElement('div');
      titleEl.className = 'card-title';
      titleEl.textContent = movie.name;

      var metaEl = document.createElement('div');
      metaEl.className = 'card-meta';

      if (rating) {
        var r = document.createElement('span');
        r.className = 'card-rating';
        r.innerHTML = starSvg + ' ' + rating;
        metaEl.appendChild(r);
      }
      if (year) {
        var y = document.createElement('span');
        y.textContent = year;
        metaEl.appendChild(y);
      }

      info.appendChild(titleEl);
      info.appendChild(metaEl);
      overlay.appendChild(info);
      card.appendChild(img);
      card.appendChild(overlay);

      return card;
    }

    // ── Load and render ───────────────────────
    async function loadMovies() {
      const errorEl = document.getElementById("errorState");
      const skeletonEl = document.getElementById("skeletonGrid");
      const gridEl = document.getElementById("movieGrid");
      errorEl.style.display = "none";
      skeletonEl.style.display = "";
      gridEl.style.display = "none";

      try {
        const [resp1, resp2] = await Promise.all([
          fetch(CATALOG_URL),
          fetch(CATALOG_URL + "?skip=20"),
        ]);
        if (!resp1.ok) throw new Error("Server returned " + resp1.status);
        const data1 = await resp1.json();
        var metas1 = data1.metas || [];
        var metas2 = [];
        if (resp2.ok) {
          var data2 = await resp2.json();
          metas2 = data2.metas || [];
        }
        allMovies = metas1.concat(metas2);

        if (allMovies.length === 0) throw new Error("No movies found");

        // Pick random movie for hero
        const heroMovie = allMovies[Math.floor(Math.random() * allMovies.length)];
        buildHero(heroMovie);

        // Build grid (exclude hero movie, show 24 cards)
        const gridMovies = allMovies.filter(function (m) { return m.id !== heroMovie.id; }).slice(0, 24);
        gridEl.innerHTML = "";
        gridMovies.forEach(function (m) { gridEl.appendChild(buildCard(m)); });

        skeletonEl.style.display = "none";
        gridEl.style.display = "";
      } catch (err) {
        skeletonEl.style.display = "none";
        errorEl.style.display = "";
        document.getElementById("errorMsg").textContent = err.message || "Could not load movies.";
        console.error("Load error:", err);
      }
    }

    // ── Kick off ──────────────────────────────
    document.addEventListener("DOMContentLoaded", loadMovies);
  </script>
</body>
</html>`;
}

module.exports = getLandingPage;
