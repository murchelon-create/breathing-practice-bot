// Файл: bot_handlers.js
const { 
  app, bot, PORT, APP_URL, ADMIN_ID,
  pendingOrders, completedOrders, startTime, logWithTime, formatUptime
} = require('./config');

const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, getUserName } = require('./utils');
const { handleTextInput, showProductInfo } = require('./handlers');
const { confirmPayment } = require('./admin');
const { setupScheduler } = require('./scheduler');
const { setupBotCommands, setupCommandHandlers } = require('./menu_commands');

const DISABLE_RESTART_NOTIFICATIONS = process.env.DISABLE_RESTART_NOTIFICATIONS === 'true' || false;

// /stats
bot.command('stats', async (ctx) => {
  try {
    const adminId = ctx.from.id;
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.reply('❌ Эта команда доступна только администратору.');
      return;
    }
    const { userSources } = global.botData;
    const stats = {};
    Object.values(userSources).forEach(s => { stats[s] = (stats[s] || 0) + 1; });
    const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);

    const productNames = { trial: 'Видеоурок', intensive: 'Недельный интенсив', course: 'Курс 5 занятий' };
    const sourceNames = {
      website: 'Сайт', website_hero: 'Сайт (главный экран)', website_footer: 'Сайт (подвал)',
      telegram_channel: 'Telegram канал', telegram_group: 'Telegram группа',
      instagram: 'Instagram', vk: 'ВКонтакте', youtube: 'YouTube',
      direct: 'Прямая ссылка', unknown: 'Неизвестно'
    };

    function formatSource(source) {
      if (source.startsWith('websiteCta')) {
        const key = source.replace('websiteCta', '').toLowerCase();
        return `Сайт (CTA) → ${productNames[key] || key}`;
      }
      return sourceNames[source] || source;
    }

    let message = '📊 *Статистика по источникам:*\n\n';
    if (sortedStats.length === 0) {
      message += 'ℹ️ Пока нет данных.';
    } else {
      sortedStats.forEach(([s, c]) => { message += `${formatSource(s)}: *${c}*\n`; });
      message += `\n👥 Всего: *${Object.keys(userSources).length}*`;
    }
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error(`/stats ошибка: ${error.message}`);
    await ctx.reply('❌ Ошибка при получении статистики.');
  }
});

// Список продуктов для кнопок
const productButtons = [
  [{ text: '🟢 Видеоурок — 1 500 ₽', callback_data: 'buy_trial' }],
  [{ text: '🟡 Недельный интенсив — 14 000 ₽', callback_data: 'buy_intensive' }],
  [{ text: '🔵 Курс 5 занятий — 25 000 ₽', callback_data: 'buy_course' }],
  [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
];

// buy_course_menu — inline-кнопка из главного меню
bot.action('buy_course_menu', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    await ctx.reply(`📚 Выберите формат занятия, ${userName}:`, {
      reply_markup: { inline_keyboard: productButtons }
    });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`buy_course_menu: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Кнопка "Купить курс" через reply-клавиатуру
bot.hears('🛍️ Купить курс', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    await ctx.reply(`📚 Выберите формат занятия, ${userName}:`, {
      reply_markup: { inline_keyboard: productButtons }
    });
  } catch (error) {
    console.error(`hears Купить курс: ${error.message}`);
  }
});

// show_info
bot.action('show_info', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    try {
      await ctx.replyWithPhoto(
        { source: 'files/logo.jpg' },
        { caption: '🌬️ Метод Бутейко - научно обоснованная дыхательная гимнастика' }
      );
      await new Promise(r => setTimeout(r, 500));
    } catch (e) { /* фото может отсутствовать */ }
    await ctx.reply(
      `Привет, ${userName}!\n\n` +
      `🧬 МЕТОД БУТЕЙКО\n\n` +
      `Константин Павлович Бутейко — первый врач-физиолог, который доказал связь между неправильным дыханием и развитием более 150 заболеваний.\n\n` +
      `✅ Что происходит при правильном дыхании:\n` +
      `• Нормализуется уровень CO₂ в крови\n` +
      `• Расширяются сосуды и бронхи\n` +
      `• Улучшается кислородное питание тканей\n` +
      `• Снижается спазм гладкой мускулатуры\n\n` +
      `💪 Преимущества метода:\n` +
      `• Естественный подход без лекарств\n` +
      `• Безопасен при правильном освоении\n` +
      `• Навык остаётся с вами на всю жизнь\n` +
      `• Можно практиковать в любом месте\n\n` +
      `Выберите 🛍️ Купить курс в меню.\n\n` +
      `📞 Связаться: [Александр Попов](https://t.me/AS_Popov87)`,
      { parse_mode: 'Markdown', reply_markup: mainKeyboard().reply_markup }
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`show_info: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// show_purchases
bot.action('show_purchases', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { completedOrders } = global.botData;
    if (!completedOrders[userId] || completedOrders[userId].length === 0) {
      await ctx.reply(messageTemplates.noPurchases, { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery('У вас пока нет покупок');
      return;
    }
    let message = '*Ваши покупки:*\n\n';
    completedOrders[userId].forEach((order, i) => {
      const product = products[order.productId];
      message += `*${i + 1}. ${product.name}*\n📅 ${new Date(order.completedAt).toLocaleDateString()}\n💳 ${product.price}\n\n`;
    });
    message += 'Для повторного доступа напишите [Александру](https://t.me/AS_Popov87)';
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: mainKeyboard().reply_markup });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`show_purchases: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// show_consultations
bot.action('show_consultations', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { completedOrders } = global.botData;
    const all = completedOrders[userId] || [];
    const consultations = all.filter(o => ['trial','intensive','course'].includes(o.productId));
    if (consultations.length === 0) {
      await ctx.reply('У вас пока нет консультаций.', { reply_markup: mainKeyboard().reply_markup });
      await ctx.answerCbQuery('Нет консультаций');
      return;
    }
    let message = '*Ваши консультации:*\n\n';
    consultations.forEach((c, i) => {
      const product = products[c.productId];
      message += `*${i + 1}. ${product.name}*\n📅 ${new Date(c.completedAt).toLocaleDateString()}\n`;
      message += c.recordingSent ? `🎥 Запись: ✅\n` : `🎥 Запись: ⏳ ожидает отправки\n`;
      message += '\n';
    });
    message += 'Свяжитесь с [Александром](https://t.me/AS_Popov87)';
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: consultationsKeyboard().reply_markup });
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`show_consultations: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// back_to_menu
bot.action('back_to_menu', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    await ctx.reply(`${userName}, вы вернулись в главное меню.`, mainKeyboard());
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`back_to_menu: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// main_menu
bot.action('main_menu', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    await ctx.reply(`${userName}, вы вернулись в главное меню.`, mainKeyboard());
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`main_menu: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// refresh_consultations
bot.action('refresh_consultations', async (ctx) => {
  try {
    await ctx.answerCbQuery('Обновлено');
    await ctx.deleteMessage();
    ctx.update.callback_query.data = 'show_consultations';
    await bot.handleUpdate(ctx.update);
  } catch (error) {
    console.error(`refresh_consultations: ${error.message}`);
    await ctx.answerCbQuery('Ошибка');
  }
});

// confirm_payment_
bot.action(/^confirm_payment_(.+)$/, async (ctx) => {
  try {
    const clientId = ctx.match[1];
    await confirmPayment(clientId);
    const order = global.botData.pendingOrders?.[clientId] ||
      global.botData.completedOrders?.[clientId]?.slice(-1)[0];
    const isConsultation = order && ['trial','intensive','course'].includes(order.productId);
    try {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: isConsultation
          ? [[{ text: '🎥 Отправить запись', callback_data: `send_recording_${clientId}` }],
             [{ text: '✅ Оплата подтверждена', callback_data: 'payment_confirmed_done' }]]
          : [[{ text: '✅ Оплата подтверждена', callback_data: 'payment_confirmed_done' }]]
      });
    } catch (e) { /* не критично */ }
    await ctx.answerCbQuery('Оплата подтверждена!');
    logWithTime(`[ADMIN] Оплата подтверждена для ${clientId}`);
  } catch (error) {
    console.error(`confirm_payment: ${error.message}`);
    await ctx.answerCbQuery('Ошибка');
  }
});

// send_recording_
bot.action(/^send_recording_(.+)$/, async (ctx) => {
  try {
    const clientId = ctx.match[1];
    await ctx.reply(`🎥 Введите ссылку на запись для пользователя ${clientId}:`,
      { reply_markup: { force_reply: true } });
    if (!global.botData.pendingRecordings) global.botData.pendingRecordings = {};
    global.botData.pendingRecordings[ctx.from.id] = clientId;
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`send_recording: ${error.message}`);
    await ctx.answerCbQuery('Ошибка');
  }
});

// payment_confirmed_done
bot.action('payment_confirmed_done', async (ctx) => {
  try { await ctx.answerCbQuery('Уже отмечено'); } catch (e) {}
});

// buy_ — показываем fullDescription, затем запрашиваем email
bot.action(/^buy_(.+)$/, async (ctx) => {
  try {
    const productId = ctx.match[1];
    const product = products[productId];
    if (!product) { await ctx.answerCbQuery('Продукт не найден'); return; }

    await ctx.answerCbQuery();

    // Показываем описание продукта из data.js
    await showProductInfo(ctx, productId);

    // Небольшая пауза, чтобы пользователь успел прочитать
    await new Promise(r => setTimeout(r, 800));

    // Сохраняем заказ и запрашиваем email
    if (!global.botData.pendingOrders) global.botData.pendingOrders = {};
    global.botData.pendingOrders[ctx.from.id] = {
      productId, step: 'email', startedAt: new Date().toISOString()
    };
    await ctx.reply(messageTemplates.emailRequest(product.name), { reply_markup: { force_reply: true } });

    logWithTime(`Пользователь ${ctx.from.id} начал заказ: ${productId}`);
  } catch (error) {
    console.error(`buy_: ${error.message}`);
    try { await ctx.answerCbQuery('Произошла ошибка'); } catch (e) {}
  }
});

// Текстовые сообщения
bot.on('text', async (ctx) => {
  try {
    await handleTextInput(ctx);
  } catch (error) {
    console.error(`text: ${error.message}`);
    await ctx.reply(messageTemplates.errorMessage, { parse_mode: 'Markdown' });
  }
});

// Запуск бота
async function startBot() {
  try {
    logWithTime('🚀 Запуск бота...');
    if (!global.botData) {
      global.botData = { pendingOrders: {}, completedOrders: {}, userSources: {} };
    }
    await setupBotCommands(bot);
    const { handleStart } = require('./handlers');
    setupCommandHandlers(bot, handleStart);
    setupScheduler(bot);

    await bot.telegram.deleteWebhook();
    bot.launch();
    logWithTime('✅ Бот запущен в режиме polling');

    if (!DISABLE_RESTART_NOTIFICATIONS) {
      try {
        await bot.telegram.sendMessage(ADMIN_ID, '🟢 Бот успешно запущен!');
      } catch (err) {
        logWithTime(`⚠️ Не удалось отправить уведомление: ${err.message}`);
      }
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
