import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

const DEFAULT_DATA = {
  users: {},
};

function ensureUserRecord(data, userId) {
  const key = String(userId);
  if (!data.users[key]) {
    data.users[key] = {
      history: [],
      favorites: [],
      lastQuery: null,
    };
  }
  return data.users[key];
}

async function readStore() {
  try {
    const raw = await fs.readFile(config.storageFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      users:
        typeof parsed.users === "object" && parsed.users !== null
          ? parsed.users
          : {},
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return structuredClone(DEFAULT_DATA);
    }
    throw err;
  }
}

async function writeStore(data) {
  const dir = path.dirname(config.storageFilePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${config.storageFilePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tempPath, config.storageFilePath);
}

export async function addHistoryEntry(userId, query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const data = await readStore();
  const user = ensureUserRecord(data, userId);

  user.lastQuery = cleanQuery;
  user.history = [
    cleanQuery,
    ...user.history.filter(
      (item) => item.toLowerCase() !== cleanQuery.toLowerCase(),
    ),
  ].slice(0, 10);

  await writeStore(data);
}

export async function getLastQuery(userId) {
  const data = await readStore();
  const user = ensureUserRecord(data, userId);
  return user.lastQuery || user.history[0] || null;
}

export async function getHistory(userId) {
  const data = await readStore();
  const user = ensureUserRecord(data, userId);
  return user.history;
}

export async function getFavorites(userId) {
  const data = await readStore();
  const user = ensureUserRecord(data, userId);
  return user.favorites;
}

export async function isFavorite(userId, gameId) {
  const favorites = await getFavorites(userId);
  return favorites.some((item) => Number(item.id) === Number(gameId));
}

export async function getFavoriteById(userId, gameId) {
  const favorites = await getFavorites(userId);
  return favorites.find((item) => Number(item.id) === Number(gameId)) || null;
}

export async function toggleFavorite(userId, gamePayload) {
  const data = await readStore();
  const user = ensureUserRecord(data, userId);
  const targetId = Number(gamePayload.id);
  const exists = user.favorites.some((item) => Number(item.id) === targetId);

  if (exists) {
    user.favorites = user.favorites.filter(
      (item) => Number(item.id) !== targetId,
    );
    await writeStore(data);
    return { saved: false, favorites: user.favorites };
  }

  user.favorites = [
    gamePayload,
    ...user.favorites.filter((item) => Number(item.id) !== targetId),
  ].slice(0, 30);
  await writeStore(data);
  return { saved: true, favorites: user.favorites };
}
