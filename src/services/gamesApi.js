import { config } from "../config.js";

function stripHtml(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} от игрового API`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGameByTitle(title) {
  const query = title?.trim();
  if (!query) {
    throw new Error("Пустой поисковый запрос");
  }

  const searchUrl = `${config.gamesApiBaseUrl}/games?key=${encodeURIComponent(config.gamesApiKey)}&search=${encodeURIComponent(query)}&page_size=1`;
  const searchData = await fetchJson(searchUrl);

  const firstGame = searchData?.results?.[0];
  if (!firstGame?.id) {
    return null;
  }

  const detailsUrl = `${config.gamesApiBaseUrl}/games/${firstGame.id}?key=${encodeURIComponent(config.gamesApiKey)}`;
  const details = await fetchJson(detailsUrl);

  const year = details.released ? details.released.slice(0, 4) : "н/д";
  const developers =
    Array.isArray(details.developers) && details.developers.length > 0
      ? details.developers.map((d) => d.name).join(", ")
      : "н/д";
  const genres =
    Array.isArray(details.genres) && details.genres.length > 0
      ? details.genres.map((g) => g.name).join(", ")
      : "н/д";
  const rating =
    typeof details.rating === "number" ? details.rating.toFixed(1) : "н/д";
  const rawDescription =
    details.description_raw ||
    stripHtml(details.description) ||
    "Описание отсутствует.";
  const sourceUrl = details.slug
    ? `https://rawg.io/games/${details.slug}`
    : details.website || "https://rawg.io";

  return {
    id: details.id,
    title: details.name || firstGame.name,
    year,
    developers,
    genres,
    rating,
    description: rawDescription,
    sourceUrl,
  };
}
