// index.js - Главный файл бота
const { logWithTime } = require('./utils');
const { products, messageTemplates } = require('./data');
const {
  app,
  bot,
  PORT,
  APP_URL,
  ADMIN_ID,
  pendingOrders,
  completedOrders,
  startTime,
  formatUptime
} = require('./config');
const { mainKeyboard, consultationsKeyboard, removeKeyboard, sendMessageWithInlineKeyboard, fileExists } = require('./utils');
const { handleStart } = require('./handlers');
const { confirmPayment, sendConsultationRecording } = require('./admin');
const { setupScheduler } = require('./scheduler');
const { setupBotCommands, setupCommandHandlers } = require('./menu_commands');

// Обработчик команды /start
bot.command('start', handleStart);

// Обработчик кнопки "Главное меню"
bot.action('main_menu', async (ctx) => {
  try {
    const { getUserName } = require('./utils');
    const userName = getUserName(ctx.from);
    await ctx.reply(
      `${userName}, вы вернулись в главное меню.`,
      mainKeyboard()
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка в main_menu: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик кнопки "Купить курс"
bot.action('buy_course_menu', async (ctx) => {
  try {
    const { getUserName } = require('./utils');
    const userName = getUserName(ctx.from);
    await ctx.reply(
      `📚 Выберите формат занятия, ${userName}:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🟢 Пробное занятие — 1 500 ₽', callback_data: 'buy_trial' }],
            [{ text: '🟡 Недельный интенсив — 14 000 ₽', callback_data: 'buy_intensive' }],
            [{ text: '🔵 Курс 5 занятий — 25 000 ₽', callback_data: 'buy_course' }],
            [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} открыл меню покупки`);
  } catch (error) {
    console.error(`Ошибка в buy_course_menu: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для кнопки "Купить" через клавиатуру
bot.hears('🛍️ Купить курс', async (ctx) => {
  try {
    const { getUserName } = require('./utils');
    const userName = getUserName(ctx.from);
    await ctx.reply(
      `📚 Выберите формат занятия, ${userName}:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🟢 Пробное занятие — 1 500 ₽', callback_data: 'buy_trial' }],
            [{ text: '🟡 Недельный интенсив — 14 000 ₽', callback_data: 'buy_intensive' }],
            [{ text: '🔵 Курс 5 занятий — 25 000 ₽', callback_data: 'buy_course' }],
            [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    logWithTime(`Пользователь ${ctx.from.id} открыл меню покупки через клавиатуру`);
  } catch (error) {
    console.error(`Ошибка в hears Купить курс: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработчики административных кнопок
bot.action(/^confirm_payment_(.+)$/, async (ctx) => {
  try {
    const clientId = ctx.match[1];
    logWithTime(`[ADMIN] Админ подтверждает оплату для clientId: ${clientId}`);
    
    await confirmPayment(clientId);
    
    const order = pendingOrders[clientId] || completedOrders[clientId]?.[completedOrders[clientId].length - 1];
    const isConsultation = order && (order.productId === 'trial' || order.productId === 'intensive' || order.productId === 'course');
    
    try {
      if (isConsultation) {
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [{ text: '🎥 Отправить запись занятия', callback_data: `send_recording_${clientId}` }],
            [{ text: '✅ Оплата подтверждена', callback_data: 'payment_confirmed_done' }]
          ]
        });
      } else {
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [{ text: '✅ Оплата подтверждена', callback_data: 'payment_confirmed_done' }]
          ]
        });
      }
    } catch (editError) {
      logWithTime(`[ADMIN] Не удалось обновить кнопки: ${editError.message}`);
    }
    
    await ctx.answerCbQuery('Оплата подтверждена!');
    logWithTime(`[ADMIN] Оплата подтверждена для пользователя ${clientId}`);
  } catch (error) {
    console.error(`[ADMIN] Ошибка при подтверждении оплаты: ${error.message}`);
    await ctx.answerCbQuery('Ошибка при подтверждении');
  }
});

// Обработчик для отправки записи консультации
bot.action(/^send_recording_(.+)$/, async (ctx) => {
  try {
    const clientId = ctx.match[1];
    logWithTime(`[ADMIN] Отправка записи для clientId: ${clientId}`);
    
    await ctx.reply(
      `🎥 Отправка записи консультации\n\nВведите ссылку на запись для пользователя ${clientId}:`,
      { reply_markup: { force_reply: true } }
    );
    
    if (!global.botData.pendingRecordings) {
      global.botData.pendingRecordings = {};
    }
    global.botData.pendingRecordings[ctx.from.id] = clientId;
    
    await ctx.answerCbQuery();
    logWithTime(`[ADMIN] Ожидаем ссылку записи для clientId: ${clientId}`);
  } catch (error) {
    console.error(`[ADMIN] Ошибка при отправке записи: ${error.message}`);
    await ctx.answerCbQuery('Ошибка при отправке');
  }
});

// Обработчик для кнопки "Оплата подтверждена"
bot.action('payment_confirmed_done', async (ctx) => {
  try {
    await ctx.answerCbQuery('Уже отмечено');
  } catch (error) {
    console.error(`Ошибка в payment_confirmed_done: ${error.message}`);
  }
});

// Обработчик текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    const { handleTextInput } = require('./handlers');
    await handleTextInput(ctx);
  } catch (error) {
    console.error(`Ошибка при обработке текста: ${error.message}`);
    await ctx.reply(messageTemplates.errorMessage, { parse_mode: 'Markdown' });
  }
});

// Запуск бота
async function startBot() {
  try {
    logWithTime('🚀 Запуск бота...');

    if (!global.botData) {
      global.botData = {
        pendingOrders: {},
        completedOrders: {},
        userSources: {}
      };
    }

    await setupBotCommands(bot);
    setupCommandHandlers(bot, handleStart);
    setupScheduler(bot);

    // Удаляем вебхук и запускаем polling
    await bot.telegram.deleteWebhook();
    bot.launch();
    logWithTime('✅ Бот запущен в режиме polling');

    try {
      await bot.telegram.sendMessage(ADMIN_ID, '🟢 Бот успешно запущен!');
    } catch (err) {
      logWithTime(`⚠️ Не удалось отправить уведомнеие о запуске: ${err.message}`);
    }

    logWithTime('✅ Бот успешно инициализирован');
  } catch (error) {
    console.error(`❌ Критическая ошибка при запуске: ${error.message}`);
    process.exit(1);
  }
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

startBot();

module.exports = { startBot };
