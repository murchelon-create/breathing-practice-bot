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

// Создаем глобальный объект для хранения данных бота
global.botData = {
  bot,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
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

// Функция для очистки старых обновлений Telegram
const clearPendingUpdates = async () => {
  try {
    logWithTime('Очистка старых обновлений Telegram...');
    
    // Получаем информацию о вебхуке
    const webhookInfo = await bot.telegram.getWebhookInfo();
    const pendingCount = webhookInfo.pending_update_count || 0;
    
    if (pendingCount > 0) {
      logWithTime(`Найдено ${pendingCount} необработанных обновлений, очищаем...`);
      
      // Удаляем вебхук с параметром drop_pending_updates
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      logWithTime('✅ Старые обновления очищены');
      
      return true;
    } else {
      logWithTime('✅ Нет необработанных обновлений');
      return true;
    }
  } catch (error) {
    console.error(`❌ Ошибка при очистке обновлений: ${error.message}`);
    return false;
  }
};

// Настройка вебхука для Telegram бота
const setupWebhook = async () => {
  try {
    if (!APP_URL) {
      throw new Error('APP_URL не указан в переменных окружения');
    }

    logWithTime(`Попытка установки вебхука на: ${webhookUrl}`);

    // Очищаем старые обновления
    await clearPendingUpdates();

    // Устанавливаем новый вебхук с параметром drop_pending_updates
    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true
    });
    logWithTime('✅ Вебхук успешно установлен');

    // Проверяем, что вебхук установлен
    const webhookInfo = await bot.telegram.getWebhookInfo();
    logWithTime(`Информация о вебхуке: pending_update_count=${webhookInfo.pending_update_count}`);

    if (webhookInfo.url !== webhookUrl) {
      logWithTime(`⚠️ URL вебхука отличается: установлен="${webhookInfo.url}", ожидается="${webhookUrl}"`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Ошибка при установке вебхука: ${error.message}`);
    logWithTime(`⚠️ Вебхук не установлен автоматически, но обработчик работает`);
    logWithTime(`💡 Установите вручную через: https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`);
    return false;
  }
};

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
  startTime,
  setupWebhook,
  clearPendingUpdates,
  logWithTime,
  formatUptime
};
