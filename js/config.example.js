/*
 * Локальная настройка (НЕ коммитить настоящий config.js).
 * Скопируйте этот файл как js/config.js и замените значения только для
 * локальной проверки. На GitHub Pages этот файл генерирует deploy.yml из Secrets.
 *
 * Важно: любой токен, подставленный в статический JavaScript, технически виден
 * посетителю сайта в инструментах браузера. Для настоящей секретности используйте
 * Cloudflare Worker и храните BOT_TOKEN там.
 */
window.TELEGRAM_CONFIG = {
  BOT_TOKEN: 'PASTE_BOT_TOKEN_HERE',
  CHAT_ID: 'PASTE_CHAT_ID_HERE'
};
