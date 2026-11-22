import { config } from "../config.js";

function takeExcerpt(text = "", maxChars = 500) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) {
    return clean;
  }
  const sliced = clean.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${lastSpace > 100 ? sliced.slice(0, lastSpace) : sliced}…`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function translateToRussian(text) {
  const excerpt = takeExcerpt(text, 500);
  if (!excerpt || excerpt === "Описание отсутствует.") {
    return excerpt;
  }

  // Если уже есть кириллица, лишний перевод можно пропустить
  if (/[а-яА-ЯёЁ]/.test(excerpt)) {
    return excerpt;
  }

  try {
    if (config.translateApiUrl) {
      const headers = { "Content-Type": "application/json" };
      if (config.translateApiKey) {
        headers.Authorization = `Bearer ${config.translateApiKey}`;
      }

      const response = await fetchWithTimeout(config.translateApiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: excerpt,
          source: "en",
          target: "ru",
          format: "text",
        }),
      });

      if (!response.ok) {
        return excerpt;
      }

      const data = await response.json();
      return (
        data.translatedText ||
        data.data?.translatedText ||
        excerpt
      ).trim();
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(excerpt)}&langpair=en|ru`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return excerpt;
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || /MYMEMORY WARNING/i.test(translated)) {
      return excerpt;
    }

    return translated.trim();
  } catch {
    return excerpt;
  }
}
