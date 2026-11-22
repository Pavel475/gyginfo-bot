function makeShortSummary(text = "", maxSentences = 2, maxLength = 280) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Краткое описание недоступно.";
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [normalized];
  let summary = sentences.slice(0, maxSentences).join(" ").trim();

  if (summary.length > maxLength) {
    const cut = summary.slice(0, maxLength);
    const spaceIdx = cut.lastIndexOf(" ");
    summary = `${spaceIdx > 80 ? cut.slice(0, spaceIdx) : cut}…`;
  }

  return summary;
}

export function formatGameCard(game, translatedDescription) {
  const summary = makeShortSummary(translatedDescription || game.description);

  const lines = [
    `🎮 *${game.title}* (${game.year})`,
    `🛠 *Студия:* ${game.developers}`,
    `🏷 *Жанры:* ${game.genres} · ⭐ *Рейтинг:* ${game.rating}/5`,
    `📝 ${summary}`,
    `🔗 [Источник (RAWG)](${game.sourceUrl})`,
  ];

  return lines.join("\n");
}
