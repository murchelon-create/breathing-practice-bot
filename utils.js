// Файл: utils.js
// Вспомогательные функции для бота

const fs = require('fs');
const { Markup } = require('telegraf');

// Функция для создания основной клавиатуры с использованием inline-кнопок
function mainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🛒 Купить курс', 'show_products'),
      Markup.button.callback('❓ Информация', 'show_info')
    ],
    [
      Markup.button.callback('📝 Мои покупки', 'show_purchases'),
      Markup.button.callback('🎬 Мои консультации', 'show_consultations')
    ],
    [
      Markup.button.url('☎️ Связаться с преподавателем', 'https://t.me/AS_Popov87')
    ]
  ]);
}

// Функция для создания клавиатуры раздела "Мои консультации"
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

// Функция для удаления клавиатуры
function removeKeyboard() {
  return Markup.removeKeyboard();
}

// Функция для отправки сообщения с удалением клавиатуры и добавлением inline-кнопок
async function sendMessageWithInlineKeyboard(ctx, text, options = {}) {
  return await ctx.reply(text, {
    ...options,
    reply_markup: {
      ...mainKeyboard().reply_markup,
      remove_keyboard: index
    }
  });
}

// Кэш для существования файлов
const fileExistsCache = new Map();

// Функция для проверки существования файла с кэшированием
function fileExists(filePath) {
  // Если результат уже в кэше, используем его
  if (fileExistsCache.has(filePath)) {
    return Promise.resolve(fileExistsCache.get(filePath));
  }
  
  return new Promise(resolve => {
    fs.access(filePath, fs.constants.F_OK, err => {
      const exists = !err;
      // Сохраняем результат в кэше
      fileExistsCache.set(filePath, exists);
      resolve(exists);
    });
  });
}

// Функция логирования с датой и временем
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Валидаторы для ввода пользователя
const validators = {
  email: (text) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  },
  
  phone: (text) => {
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(text.replace(/\s+/g, ''));
  },
  
  url: (text) => {
    const urlRegex = /^(http|https):\/\/[^ "]+$/;
    return urlRegex.test(text);
  }
};

/**
 * Функция для получения лучшего варианта обращения к пользователю
 * Возвращает имя пользователя из доступных данных с учетом предпочтений
 * 
 * @param {Object} user - Объект пользователя из ctx.from
 * @param {boolean} useLongName - Использовать ли полное имя, если доступно
 * @returns {string} - Имя пользователя для обращения
 */
function getUserName(user, useLongName = false) {
  if (!user) return 'друг';
  
  // Получаем доступные данные
  const firstName = user.first_name ? user.first_name.trim() : '';
  const lastName = user.last_name ? user.last_name.trim() : '';
  const username = user.username ? user.username.trim() : '';
  
  // Детектор русских имен/фамилий - примерный признак наличия кириллицы
  const isCyrillic = (text) => /[а-яА-ЯёЁ]/.test(text);
  
  // Проверяем, есть ли имя
  if (firstName) {
    // В русских именах может быть указано "Иван Иванович" - пытаемся выделить первую часть
    if (isCyrillic(firstName) && firstName.includes(' ')) {
      // Если есть пробел, берем первую часть (предположительно имя без отчества)
      return firstName.split(' ')[0];
    }
    
    // Для длинного формата можем добавить фамилию
    if (useLongName && lastName) {
      return `${firstName} ${lastName}`;
    }
    
    // В остальных случаях возвращаем просто имя
    return firstName;
  }
  
  // Если имени нет, но есть username
  if (username) {
    return username;
  }
  
  // Если есть только фамилия
  if (lastName) {
    return lastName;
  }
  
  // Если ничего нет, используем стандартное обращение
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
