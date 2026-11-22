import { config } from "./config.js";
import { callTelegram, handleUpdate } from "./handlers/botHandlers.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startBot() {
  console.log("Запуск Telegram-бота игрового справочника...");
  console.log(`Хранилище настроено по пути: ${config.storageFilePath}`);

  let offset = 0;

  while (true) {
    try {
      const updates = await callTelegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (err) {
      console.error("Ошибка цикла опроса Telegram:", err);
      await sleep(3000);
    }
  }
}

startBot();
