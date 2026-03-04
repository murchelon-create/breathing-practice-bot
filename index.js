// Файл: index.js
// Основной файл Telegram-бота с поддержкой вебхуков

// Импортируем общую конфигурацию
const { 
  app, 
  bot, 
  PORT, 
  APP_URL, 
  ADMIN_ID, 
  pendingOrders, 
  completedOrders,
  startTime,
  setupWebhook,
  logWithTime,
  formatUptime
} = require('./config');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, removeKeyboard, sendMessageWithInlineKeyboard, fileExists } = require('./utils');
const { handleStart, handleBuyAction, handleConfirmBuy, handleTextInput } = require('./handlers');
const { notifyAdmin, confirmPayment, sendConsultationRecording } = require('./admin');
const { setupPing } = require('./ping');
const { setupScheduler } = require('./scheduler');

// Логирование всех callback запросов
bot.on('callback_query', (ctx, next) => {
  console.log('=========== CALLBACK QUERY RECEIVED ===========');
  console.log('Data:', ctx.callbackQuery.data);
  console.log('From user:', ctx.from.id);
  console.log('Message ID:', ctx.callbackQuery.message.message_id);
  console.log('===============================================');
  
  // Продолжаем выполнение цепочки обработчиков
  return next();
});

// Обработчики команд
bot.start(handleStart);

// Обработчики для inline-кнопок
bot.action('show_products', async (ctx) => {
  try {
    await ctx.reply(
      '📚 Выберите продукт:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔰 Стартовый комплект - 990 ₽', callback_data: 'buy_starter' }],
            [{ text: '👤 Разовая консультация - 5 000 ₽', callback_data: 'buy_individual' }],
            [{ text: '🎯 Пакет 5 занятий - 22 000 ₽', callback_data: 'buy_package' }],
            [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта`);
  } catch (error) {
    console.error(`Ошибка в обработчике "Купить курс": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для продуктов, которые в разработке
bot.action('product_in_development', async (ctx) => {
  try {
    await ctx.reply(
      '🔄 *Продукт находится в разработке*\\n\\nПолный курс видеоуроков в настоящее время дорабатывается, чтобы предоставить вам наилучший опыт обучения.\\n\\nМы уведомим вас, когда он будет доступен для покупки. В настоящее время вы можете приобрести другие наши продукты.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Вернуться к списку продуктов', callback_data: 'show_products' }]
          ]
        }
      }
    );
    
    await ctx.answerCbQuery('Этот продукт пока в разработке');
    logWithTime(`Пользователь ${ctx.from.id} попытался выбрать продукт в разработке`);
  } catch (error) {
    console.error(`Ошибка при обработке продукта в разработке: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

bot.action('back_to_menu', async (ctx) => {
  try {
    await ctx.editMessageText(
      'Выберите действие:',
      mainKeyboard()
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при возврате в меню: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработка покупок - ТОЛЬКО ОДИН обработчик для выбора продуктов
bot.action(/buy_(.+)/, handleBuyAction);

// Обработчик для простой кнопки оформления заказа - универсальный для всех продуктов
bot.action(/confirm_simple_(.+)/, async (ctx) => {
  console.log('========== УПРОЩЕННЫЙ ОБРАБОТЧИК ЗАПУЩЕН ==========');
  const productId = ctx.match[1];
  const userId = ctx.from.id;
  console.log(`Пользователь ${userId} нажал на простую кнопку для продукта ${productId}`);
  
  try {
    // Получаем выбранный продукт
    const product = products[productId];
    
    if (!product) {
      console.error(`Продукт с ID ${productId} не найден`);
      await ctx.answerCbQuery('Продукт не найден');
      return false;
    }
    
    // Отправляем запрос на email
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем информацию о выбранном продукте
    global.botData.pendingOrders[userId] = {
      productId: productId,
      status: 'waiting_email',
      timestamp: new Date().toISOString(),
      simpleHandler: true
    };
    
    await ctx.answerCbQuery('✅ Начинаем оформление заказа');
    console.log(`Пользователь ${userId} начал оформление через простую кнопку для продукта ${productId}`);
    logWithTime(`[CONFIRM_SIMPLE] Начато оформление заказа для пользователя ${userId}, продукт: ${product.name}`);
    return true;
  } catch (error) {
    console.error(`Ошибка в простом обработчике: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    await ctx.answerCbQuery('Произошла ошибка');
    return false;
  }
});

// Загружаем остальные обработчики из отдельного файла
require('./bot_handlers');
