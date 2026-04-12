// Файл: bot_handlers.js
// Дополнительные обработчики и запуск сервера с оптимизацией для Railway

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
  logWithTime,
  formatUptime
} = require('./config');

// Импортируем модули
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, removeKeyboard, getUserName } = require('./utils');
const { handleTextInput } = require('./handlers');
const { confirmPayment, sendConsultationRecording } = require('./admin');
const { setupPing } = require('./ping');
const { setupScheduler } = require('./scheduler');
const { setupBotCommands, setupCommandHandlers } = require('./menu_commands');

// Флаг оптимизации для Railway
const RAILWAY_OPTIMIZED_MODE = true;
// Флаг для отключения стартовых уведомлений
const DISABLE_RESTART_NOTIFICATIONS = process.env.DISABLE_RESTART_NOTIFICATIONS === 'true' || false;

// 🆕 КОМАНДА /stats ДЛЯ СТАТИСТИКИ ИСТОЧНИКОВ
bot.command('stats', async (ctx) => {
  try {
    const adminId = ctx.from.id;
    
    // Проверяем, что это админ
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.reply('❌ Эта команда доступна только администратору.');
      return;
    }
    
    const { userSources } = global.botData;
    
    // Подсчитываем статистику
    const stats = {};
    Object.values(userSources).forEach(source => {
      stats[source] = (stats[source] || 0) + 1;
    });
    
    // Сортируем по количеству (по убыванию)
    const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
    
    function getSourceEmoji(source) {
      if (source.startsWith('websiteCta')) {
        return '🌐';
      }
      
      const emojiMap = {
        'website': '🌐', 'website_hero': '🌐', 'website_footer': '🌐',
        'telegram_channel': '💬', 'telegram_group': '💬',
        'instagram': '📸', 'vk': '🔵', 'youtube': '📺',
        'direct': '👤', 'unknown': '❓'
      };
      
      return emojiMap[source] || '❓';
    }
    
    function formatSource(source) {
      if (source.startsWith('websiteCta')) {
        const productPartRaw = source.replace('websiteCta', '');
        const productKey = productPartRaw.charAt(0).toLowerCase() + productPartRaw.slice(1);
        
        const productNames = {
          trial: 'Пробное занятие',
          intensive: 'Недельный интенсив',
          course: 'Курс 5 занятий'
        };
        
        const productName = productNames[productKey] || productPartRaw || 'неизвестный продукт';
        return `Сайт (CTA) → ${productName}`;
      }
      
      const sourceNames = {
        'website': 'Сайт', 'website_hero': 'Сайт (главный экран)',
        'website_footer': 'Сайт (подвал)',
        'telegram_channel': 'Telegram канал @spokoinoe_dyhanie', 'telegram_group': 'Telegram группа',
        'instagram': 'Instagram', 'vk': 'ВКонтакте', 'youtube': 'YouTube',
        'direct': 'Прямая ссылка', 'unknown': 'Неизвестно'
      };
      
      return sourceNames[source] || source;
    }
    
    // Формируем сообщение
    let message = '📊 *Статистика по источникам:*\n\n';
    
    if (sortedStats.length === 0) {
      message += 'ℹ️ Пока нет данных об источниках.\n\n';
      message += 'Используйте ссылки с метками из файла SOURCES.md';
    } else {
      sortedStats.forEach(([source, count]) => {
        const emoji = getSourceEmoji(source);
        const formattedSource = formatSource(source);
        message += `${emoji} ${formattedSource}: *${count}*\n`;
      });
      
      const totalUsers = Object.keys(userSources).length;
      message += `\n👥 Всего пользователей: *${totalUsers}*`;
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    logWithTime(`Админ ${adminId} запросил статистику по источникам`);
  } catch (error) {
    console.error(`Ошибка в /stats: ${error.message}`);
    await ctx.reply('❌ Произошла ошибка при получении статистики.');
  }
});

// Обновленный обработчик для информационного раздела
bot.action('show_info', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);

    await ctx.replyWithPhoto(
      { source: 'files/logo.jpg' },
      { caption: '🌬️ Метод Бутейко - научно обоснованная дыхательная гимнастика' }
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    await ctx.reply(
      `Привет, ${userName}!\n\n` +
      `🧬 МЕТОД БУТЕЙКО\n\n` +
      `Константин Павлович Бутейко — первый врач-физиолог, который доказал связь между неправильным дыханием и развитием более 150 заболеваний.\n\n` +
      `✅ Что происходит при правильном дыхании:\n` +
      `• Нормализуется уровень CO₂ в крови\n` +
      `• Расширяются сосуды и бронхи\n` +
      `• Улучшается кислородное питание тканей\n` +
      `• Снижается спазм гладкой мускулатуры\n\n` +
      `📊 Доказанная эффективность:\n` +
      `Метод признан Минздрава РФ и применяется в клинической практике с 1985 года.\n\n` +
      `🌟 Результаты зависят от вашей цели:\n` +
      `• Снять стресс и напряжение — несколько минут практики\n` +
      `• Улучшить сон и самочувствие — регулярная практика\n` +
      `• Серьёзные изменения в здоровье — требуют времени и системного подхода\n\n` +
      `💪 Преимущества метода:\n` +
      `• Естественный подход без лекарств\n` +
      `• Безопасен при правильном освоении\n` +
      `• Навык остаётся с вами на всю жизнь\n` +
      `• Можно практиковать в любом месте\n\n` +
      `Выберите 🛍️ Купить курс в меню, чтобы ознакомиться с доступными программами.\n\n` +
      `📞 Связаться с преподавателем: [Александр Попов](https://t.me/AS_Popov87)`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          ...mainKeyboard().reply_markup,
          remove_keyboard: true
        }
      }
    );

    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} запросил информацию`);
  } catch (error) {
    console.error(`Ошибка при обработке "Информация": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для просмотра покупок
bot.action('show_purchases', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { completedOrders } = global.botData;

    if (!completedOrders[userId] || completedOrders[userId].length === 0) {
      await ctx.reply(
        messageTemplates.noPurchases,
        { reply_markup: mainKeyboard().reply_markup }
      );
      await ctx.answerCbQuery('У вас пока нет завершенных покупок');
      return;
    }

    const orders = completedOrders[userId];
    let message = '*Ваши покупки:*\n\n';

    orders.forEach((order, index) => {
      const product = products[order.productId];
      const orderDate = new Date(order.completedAt).toLocaleDateString();
      const orderNumber = order.orderId || `#${Date.now().toString().slice(-6)}`;

      message += `*${index + 1}. ${product.name}*\n`;
      message += `🆔 Заказ: ${orderNumber}\n`;
      message += `📅 Дата: ${orderDate}\n`;
      message += `💳 Цена: ${product.price}\n`;

      if (order.recordingSent) {
        message += `🎥 Запись консультации: ✅\n`;
      }

      message += '\n';
    });

    message += '\nДля повторного доступа к материалам напишите [Александру](https://t.me/AS_Popov87)';

    await ctx.reply(
      message, 
      { 
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard().reply_markup 
      }
    );

    await ctx.answerCbQuery('Загружена информация о ваших покупках');
    logWithTime(`Пользователь ${userId} просмотрел свои покупки`);
  } catch (error) {
    console.error(`Ошибка при обработке "Мои покупки": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для просмотра консультаций
bot.action('show_consultations', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const { completedOrders } = global.botData;

    if (!completedOrders[userId] || completedOrders[userId].length === 0) {
      await ctx.reply(
        'У вас пока нет консультаций. Выберите 🛍️ Купить курс, чтобы приобрести индивидуальную консультацию.',
        { 
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          } 
        }
      );
      await ctx.answerCbQuery('У вас пока нет консультаций');
      return;
    }

    const consultations = completedOrders[userId].filter(
      order => order.productId === 'trial' || order.productId === 'intensive' || order.productId === 'course'
    );

    if (consultations.length === 0) {
      await ctx.reply(
        'У вас пока нет индивидуальных консультаций. Выберите 🛍️ Купить курс, чтобы приобрести консультацию.',
        { 
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          } 
        }
      );
      await ctx.answerCbQuery('У вас пока нет индивидуальных консультаций');
      return;
    }

    let message = '*Ваши консультации:*\n\n';

    consultations.forEach((consultation, index) => {
      const product = products[consultation.productId];
      const orderDate = new Date(consultation.completedAt).toLocaleDateString();
      const orderNumber = consultation.orderId || `#${Date.now().toString().slice(-6)}`;

      message += `*${index + 1}. ${product.name}*\n`;
      message += `🆔 Заказ: ${orderNumber}\n`;
      message += `📅 Дата: ${orderDate}\n`;

      if (consultation.recordingSent) {
        message += `🎥 Запись: ✅ [Доступна]\n`;
        message += `🔗 Ссылка: ${consultation.recordingLink || 'Свяжитесь с преподавателем'}\n`;
      } else {
        message += `🎥 Запись: ⏳ [Ожидает отправки]\n`;
      }

      message += '\n';
    });

    message += 'Для получения записи консультации или дополнительной информации свяжитесь с [Александром](https://t.me/AS_Popov87)';

    await ctx.reply(
      message, 
      { 
        parse_mode: 'Markdown',
        reply_markup: consultationsKeyboard().reply_markup
      }
    );

    await ctx.answerCbQuery('Загружена информация о ваших консультациях');
    logWithTime(`Пользователь ${userId} просмотрел свои консультации`);
  } catch (error) {
    console.error(`Ошибка при обработке "Мои консультации": ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик для кнопки "Обновить"
bot.action('refresh_consultations', async (ctx) => {
  try {
    await ctx.answerCbQuery('Обновлено');
    await ctx.deleteMessage();
    ctx.update.callback_query.data = 'show_consultations';
    await bot.handleUpdate(ctx.update);
  } catch (error) {
    console.error(`Ошибка при обновлении консультаций: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка при обновлении');
  }
});

// Обработчик для кнопки "Назад в меню"
bot.action('back_to_menu', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);
    await ctx.reply(
      `${userName}, вы вернулись в главное меню.`,
      mainKeyboard()
    );
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} вернулся в главное меню`);
  } catch (error) {
    console.error(`Ошибка при возврате в меню: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчики для кнопок покупки продуктов
bot.action(/^buy_(.+)$/, async (ctx) => {
  try {
    const productId = ctx.match[1];
    const product = products[productId];
    
    if (!product) {
      await ctx.answerCbQuery('Продукт не найден');
      return;
    }
    
    // Начинаем процесс заказа
    if (!global.botData.pendingOrders) {
      global.botData.pendingOrders = {};
    }
    
    global.botData.pendingOrders[ctx.from.id] = {
      productId: productId,
      step: 'email',
      startedAt: new Date().toISOString()
    };
    
    await ctx.reply(
      messageTemplates.emailRequest(product.name),
      { reply_markup: { force_reply: true } }
    );
    
    await ctx.answerCbQuery();
    logWithTime(`Пользователь ${ctx.from.id} начал заказ продукта: ${productId}`);
  } catch (error) {
    console.error(`Ошибка при обработке покупки: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Обработчик текстовых сообщений (делегируем в handlers)
bot.on('text', async (ctx) => {
  try {
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
    
    // Инициализируем глобальные данные
    if (!global.botData) {
      global.botData = {
        pendingOrders: {},
        completedOrders: {},
        userSources: {}
      };
    }
    
    // Настраиваем команды меню
    await setupBotCommands(bot);
    
    // Настраиваем обработчики команд меню
    const { handleStart } = require('./handlers');
    setupCommandHandlers(bot, handleStart);
    
    // Настраиваем планировщик
    setupScheduler(bot);
    
    // Запускаем ping для поддержания активности
    setupPing(APP_URL);
    
    // Запускаем webhook или polling в зависимости от окружения
    if (APP_URL) {
      const webhookPath = `/webhook/${process.env.BOT_TOKEN}`;
      await bot.telegram.setWebhook(`${APP_URL}${webhookPath}`);
      
      app.post(webhookPath, (req, res) => {
        bot.handleUpdate(req.body, res);
      });
      
      app.listen(PORT, () => {
        logWithTime(`✅ Бот запущен в режиме webhook на порту ${PORT}`);
        logWithTime(`🌐 Webhook URL: ${APP_URL}${webhookPath}`);
      });
    } else {
      await bot.telegram.deleteWebhook();
      bot.launch();
      logWithTime('✅ Бот запущен в режиме polling');
    }
    
    // Уведомляем администратора о запуске
    if (!DISABLE_RESTART_NOTIFICATIONS) {
      try {
        await bot.telegram.sendMessage(ADMIN_ID, '🟢 Бот успешно запущен!');
      } catch (err) {
        logWithTime(`⚠️ Не удалось отправить уведомление о запуске: ${err.message}`);
      }
    }
    
    logWithTime('✅ Бот успешно инициализирован');
  } catch (error) {
    console.error(`❌ Критическая ошибка при запуске бота: ${error.message}`);
    process.exit(1);
  }
}

// Обработка завершения процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Запускаем бота
startBot();

module.exports = { startBot };
