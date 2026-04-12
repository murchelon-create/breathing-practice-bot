// Файл: utils.js
// Вспомогательные функции для бота

const fs = require('fs');
const { Markup } = require('telegraf');

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛍️ Купить курс', 'buy_course_menu'),
      Markup.button.callback('❓ Информация', 'show_info')
    ],
    [
      Markup.button.callback('📝 Мои покупки', 'show_purchases'),
      Markup.button.callback('🎥 Мои консультации', 'show_consultations')
    ],
    [
      Markup.button.url('☎️ Связаться с преподавателем', 'https://t.me/AS_Popov87')
    ]
  ]);
}

function consultationsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Обновить список', 'refresh_consultations')
    ],
    [
      Markup.button.callback('◀️ Вернуться в меню', 'back_to_menu')
    ]
  ]);
}

function removeKeyboard() {
  return Markup.removeKeyboard();
}

async function sendMessageWithInlineKeyboard(ctx, text, options = {}) {
  return await ctx.reply(text, {
    ...options,
    reply_markup: mainKeyboard().reply_markup
  });
}

const fileExistsCache = new Map();

function fileExists(filePath) {
  if (fileExistsCache.has(filePath)) {
    return Promise.resolve(fileExistsCache.get(filePath));
  }
  return new Promise(resolve => {
    fs.access(filePath, fs.constants.F_OK, err => {
      const exists = !err;
      fileExistsCache.set(filePath, exists);
      resolve(exists);
    });
  });
}

function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

const validators = {
  email: (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text),
  phone: (text) => /^\+?[0-9]{10,15}$/.test(text.replace(/\s+/g, '')),
  url:   (text) => /^(http|https):\/\/[^ "]+$/.test(text)
};

function getUserName(user, useLongName = false) {
  if (!user) return 'друг';
  const firstName = user.first_name ? user.first_name.trim() : '';
  const lastName  = user.last_name  ? user.last_name.trim()  : '';
  const username  = user.username   ? user.username.trim()   : '';
  const isCyrillic = (t) => /[а-яА-ЯёЁ]/.test(t);
  if (firstName) {
    if (isCyrillic(firstName) && firstName.includes(' ')) return firstName.split(' ')[0];
    if (useLongName && lastName) return `${firstName} ${lastName}`;
    return firstName;
  }
  if (username) return username;
  if (lastName)  return lastName;
  return 'друг';
}

module.exports = {
  mainKeyboard,
  consultationsKeyboard,
  removeKeyboard,
  sendMessageWithInlineKeyboard,
  fileExists,
  logWithTime,
  validators,
  getUserName
};
