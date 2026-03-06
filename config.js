// Файл: config.js
// Общая конфигурация и общие объекты для всего приложения

const { Telegraf } = require('telegraf');
const express = require('express');
require('dotenv').config();

// Логирование с временной отметкой (из utils.js, дублируем здесь для избежания циклических зависимостей)
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Получаем и проверяем переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
// Приоритет: сначала APP_URL, потом RAILWAY_STATIC_URL, затем значение по умолчанию
const APP_URL = process.env.APP_URL || 'https://breathing-practice-bot-production.up.railway.app';
const PORT = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const WEBHOOK_MODE = process.env.WEBHOOK_MODE === 'true';

// Проверка обязательных переменных окружения
if (!BOT_TOKEN) {
  console.error('ОШИБКА: BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

// Логирование конфигурации
console.log('=== КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ ===');
console.log('PORT:', PORT);
console.log('APP_URL:', APP_URL);
console.log('BOT_TOKEN:', BOT_TOKEN ? 'УКАЗАН (скрыт)' : 'НЕ УКАЗАН');
console.log('ADMIN_ID:', ADMIN_ID || 'НЕ УКАЗАН');
console.log('NODE_ENV:', NODE_ENV);
console.log('WEBHOOK_MODE:', WEBHOOK_MODE);
console.log('RAILWAY_STATIC_URL:', process.env.RAILWAY_STATIC_URL || 'НЕ УКАЗАН');
console.log('===============================');

// Создание Express приложения
const app = express();

// Обработка JSON
app.use(express.json());

// Создание бота с токеном от BotFather
const bot = new Telegraf(BOT_TOKEN);

// Переменная для отслеживания времени запуска
const startTime = new Date();

// Хранение заказов
const pendingOrders = {};
const completedOrders = {};

// Хранение источников пользователей (откуда пришли клиенты)
const userSources = {}; // Структура: { userId: 'website' | 'telegram_channel' | ... }

// Создаем глобальный объект для хранения данных бота
global.botData = {
  bot,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
  userSources, // Добавляем источники в глобальное хранилище
  adminState: null, // Для хранения состояния админа
  startTime: startTime, // Запоминаем время запуска
  lastPingTime: new Date()
};

// Определяем секретный путь для вебхука (единожды)
const secretPath = `/telegraf/${BOT_TOKEN}`;
const webhookUrl = `${APP_URL}${secretPath}`;

// ВАЖНО: Настраиваем обработчик вебхука СРАЗУ, до попытки установки
app.use(bot.webhookCallback(secretPath));
logWithTime(`✅ Обработчик вебхука настроен на путь: ${secretPath}`);

// ПРИМЕЧАНИЕ: Установка вебхука теперь происходит в index.js автоматически
// Функция setupWebhook удалена из этого файла

// Форматирование времени работы
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  
  return result;
}

// Экспортируем все нужные объекты и функции
module.exports = {
  app,
  bot,
  PORT,
  APP_URL,
  ADMIN_ID,
  NODE_ENV,
  WEBHOOK_MODE,
  pendingOrders,
  completedOrders,
  userSources, // Экспортируем источники
  startTime,
  logWithTime,
  formatUptime
};
