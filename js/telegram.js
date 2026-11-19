/* global window, fetch */
(function () {
  'use strict';

  function two(value) { return String(value).padStart(2, '0'); }
  function formatTime(seconds) {
    const safe = Math.max(0, Math.round(Number(seconds) || 0));
    return `${two(Math.floor(safe / 60))}:${two(safe % 60)}`;
  }

  /**
   * Sends a compact homework report directly to Telegram Bot API.
   * The runtime config is injected by GitHub Actions and is intentionally not
   * stored in git. A static client cannot keep a bot token truly secret;
   * production projects should replace this with a Worker endpoint.
   * @param {{student:string, lesson:string, correct:number, total:number, seconds:number}} report
   * @returns {Promise<object>} Telegram API result
   */
  async function sendToTelegram(report) {
    const config = window.TELEGRAM_CONFIG || {};
    if (!config.BOT_TOKEN || !config.CHAT_ID || String(config.BOT_TOKEN).includes('PASTE_')) {
      throw new Error('Telegram пока не настроен. Добавьте BOT_TOKEN и TG_CHAT_ID в Secrets репозитория.');
    }
    const student = String(report.student || '').trim();
    if (!student) throw new Error('Сначала напишите имя ученика.');
    const text = [
      `Ученик: ${student}`,
      `Урок: ${report.lesson}`,
      `Результат: ${report.correct}/${report.total}`,
      `Время: ${formatTime(report.seconds)}`
    ].join('\n');
    const response = await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.CHAT_ID, text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.description || `Telegram вернул ошибку ${response.status}.`);
    return data;
  }

  window.TelegramHomework = { sendToTelegram, formatTime };
}());
