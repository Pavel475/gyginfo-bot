import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  }
  return value;
}

export const config = {
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  gamesApiKey: requireEnv("GAMES_API_KEY"),
  gamesApiBaseUrl: (
    process.env.GAMES_API_BASE_URL || "https://api.rawg.io/api"
  ).replace(/\/+$/, ""),
  translateApiUrl: (process.env.TRANSLATE_API_URL || "").trim(),
  translateApiKey: (process.env.TRANSLATE_API_KEY || "").trim(),
  storageFilePath: path.resolve(
    process.cwd(),
    process.env.STORAGE_FILE_PATH || "./data/storage.json",
  ),
};
