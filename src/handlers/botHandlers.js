import { config } from "../config.js";
import { searchGameByTitle } from "../services/gamesApi.js";
import { translateToRussian } from "../services/translator.js";
import { formatGameCard } from "../formatters/gameCard.js";
import {
  addHistoryEntry,
  getLastQuery,
  getHistory,
  getFavorites,
  isFavorite,
  getFavoriteById,
  toggleFavorite,
} from "../storage/store.js";

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;
const recentGamesByUser = new Map();

const BTN_FAVORITES = "⭐ Избранное";
const BTN_HISTORY = "🕘 История";

const MAIN_REPLY_KEYBOARD = {
  keyboard: [[{ text: BTN_FAVORITES }, { text: BTN_HISTORY }]],
  resize_keyboard: true,
  is_persistent: true,
};

export async function callTelegram(method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API ошибка (${method}): ${data.description || response.status}`,
    );
  }

  return data.result;
}

export async function sendMessage(chatId, text, extra = {}) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: MAIN_REPLY_KEYBOARD,
    ...extra,
  });
}

function buildGameKeyboard(gameId, saved) {
  return {
    inline_keyboard: [
      [
        {
          text: saved ? "✅ В избранном (убрать)" : "⭐ В избранное",
          callback_data: `fav_toggle:${gameId}`,
        },
        {
          text: "🔁 Повторить поиск",
          callback_data: "repeat_search",
        },
      ],
    ],
  };
}

async function showHistory(chatId, userId) {
  const history = await getHistory(userId);
  if (history.length === 0) {
    await sendMessage(
      chatId,
      "История поиска пока пуста. Напиши название любой игры.",
    );
    return;
  }

  const lines = history.map((item, idx) => `${idx + 1}. ${item}`);
  await sendMessage(chatId, `🕘 *Последние запросы:*\n${lines.join("\n")}`);
}

async function showFavorites(chatId, userId) {
  const favorites = await getFavorites(userId);
  if (favorites.length === 0) {
    await sendMessage(
      chatId,
      "В избранном пока пусто. Нажми «⭐ В избранное» под карточкой игры.",
    );
    return;
  }

  const lines = favorites
    .slice(0, 10)
    .map((g, idx) => `${idx + 1}. *${g.title}* (${g.year})`);
  const buttons = favorites.slice(0, 5).map((g) => [
    {
      text: `Открыть: ${g.title}`.slice(0, 40),
      callback_data: `fav_open:${g.id}`,
    },
  ]);

  await sendMessage(chatId, `⭐ *Избранное:*\n${lines.join("\n")}`, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function performGameSearch(chatId, userId, query) {
  await sendMessage(chatId, `🔎 Ищу «${query}»...`);

  const game = await searchGameByTitle(query);
  if (!game) {
    await sendMessage(
      chatId,
      `По запросу «${query}» ничего не найдено. Попробуй уточнить название.`,
    );
    return;
  }

  const translatedDescription = await translateToRussian(game.description);
  const cardPayload = {
    ...game,
    translatedDescription,
  };

  recentGamesByUser.set(String(userId), cardPayload);
  await addHistoryEntry(userId, query);

  const saved = await isFavorite(userId, game.id);
  const card = formatGameCard(game, translatedDescription);

  await sendMessage(chatId, card, {
    reply_markup: buildGameKeyboard(game.id, saved),
  });
}

async function handleCallbackQuery(callbackQuery) {
  const id = callbackQuery.id;
  const userId = callbackQuery.from?.id;
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data || "";

  if (!userId || !chatId) {
    return;
  }

  await callTelegram("answerCallbackQuery", { callback_query_id: id });

  if (data === "repeat_search") {
    const lastQuery = await getLastQuery(userId);
    if (!lastQuery) {
      await sendMessage(
        chatId,
        "Пока нет сохранённых запросов для повтора. Напиши название игры.",
      );
      return;
    }
    await performGameSearch(chatId, userId, lastQuery);
    return;
  }

  if (data.startsWith("fav_toggle:")) {
    const gameId = Number(data.split(":")[1]);
    const recent = recentGamesByUser.get(String(userId));
    let gameToSave = recent && Number(recent.id) === gameId ? recent : null;

    if (!gameToSave) {
      gameToSave = await getFavoriteById(userId, gameId);
    }

    if (!gameToSave) {
      await sendMessage(
        chatId,
        "Данные об игре уже неактуальны. Выполни поиск заново.",
      );
      return;
    }

    const result = await toggleFavorite(userId, gameToSave);
    await callTelegram("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: buildGameKeyboard(gameId, result.saved),
    });

    await sendMessage(
      chatId,
      result.saved
        ? `⭐ Добавлено в избранное: *${gameToSave.title}*`
        : `🗑 Удалено из избранного: *${gameToSave.title}*`,
    );
    return;
  }

  if (data.startsWith("fav_open:")) {
    const gameId = Number(data.split(":")[1]);
    const favGame = await getFavoriteById(userId, gameId);
    if (!favGame) {
      await sendMessage(chatId, "Игра не найдена в избранном.");
      return;
    }

    const card = formatGameCard(
      favGame,
      favGame.translatedDescription || favGame.description,
    );
    await sendMessage(chatId, card, {
      reply_markup: buildGameKeyboard(favGame.id, true),
    });
  }
}

export async function handleUpdate(update) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message || !message.chat || typeof message.text !== "string") {
    return;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id || chatId;
  const text = message.text.trim();

  if (!text) {
    return;
  }

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chatId,
      [
        "👋 *Игровой справочник*",
        "Напиши название игры — и я верну краткую карточку с годом, студией, жанрами, рейтингом, описанием на русском и ссылкой на источник.",
        "",
        `Используй кнопки *${BTN_FAVORITES}* и *${BTN_HISTORY}* внизу экрана или команды /favorites, /history, /help.`,
      ].join("\n"),
      { reply_markup: MAIN_REPLY_KEYBOARD },
    );
    return;
  }

  if (text === BTN_HISTORY || text === "/history") {
    await showHistory(chatId, userId);
    return;
  }

  if (text === BTN_FAVORITES || text === "/favorites") {
    await showFavorites(chatId, userId);
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(
      chatId,
      "Неизвестная команда. Напиши название игры или отправь /help.",
    );
    return;
  }

  try {
    await performGameSearch(chatId, userId, text);
  } catch (err) {
    console.error("Ошибка при обработке запроса игры:", err);
    await sendMessage(
      chatId,
      "⚠️ Не удалось получить данные об игре. Проверь соединение или попробуй повторить запрос чуть позже.",
    );
  }
}
