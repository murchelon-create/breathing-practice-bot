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
    
    // 🎯 ОБНОВЛЁННЫЕ ФУНКЦИИ ДЛЯ КОМБИНИРОВАННЫХ МЕТОК
    function getSourceEmoji(source) {
      const emojiMap = {
        'website': '🌐', 'website_hero': '🌐', 'website-cta': '🌐', 'website_footer': '🌐',
        'telegram_channel': '💬', 'telegram_group': '💬',
        'instagram': '📸', 'vk': '🔵', 'youtube': '📺',
        'direct': '👤', 'unknown': '❓'
      };
      
      // Для комбинированных меток типа website-cta-*
      if (source.startsWith('website-cta-')) {
        return '🌐';
      }
      
      return emojiMap[source] || '❓';
    }
    
    function formatSource(source) {
      const sourceNames = {
        'website': 'Сайт', 'website_hero': 'Сайт (главный экран)',
        'website-cta': 'Сайт (призыв к действию)', 'website_footer': 'Сайт (подвал)',
        'telegram_channel': 'Telegram канал @spokoinoe_dyhanie', 'telegram_group': 'Telegram группа',
        'instagram': 'Instagram', 'vk': 'ВКонтакте', 'youtube': 'YouTube',
        'direct': 'Прямая ссылка', 'unknown': 'Неизвестно'
      };
      
      // 🎯 ПОДДЕРЖКА КОМБИНИРОВАННЫХ МЕТОК website-cta-*
      if (source.startsWith('website-cta-')) {
        const product = source.replace('website-cta-', '');
        const productNames = {
          'starter': 'Стартовый',
          'consultation': 'Консультация',
          'package5': 'Пакет 5'
        };
        const productName = productNames[product] || product;
        return `Сайт (CTA) → ${productName}`;
      }
      
      return sourceNames[source] || source;
    }
    
    // Формируем сообщение
    let message = '📊 *Статистика по источникам:*\\n\\n';
    
    if (sortedStats.length === 0) {
      message += 'ℹ️ Пока нет данных об источниках.\\n\\n';
      message += 'Используйте ссылки с метками из файла SOURCES.md';
    } else {
      sortedStats.forEach(([source, count]) => {
        const emoji = getSourceEmoji(source);
        const formattedSource = formatSource(source);
        message += `${emoji} ${formattedSource}: *${count}*\\n`;
      });
      
      const totalUsers = Object.keys(userSources).length;
      message += `\\n👥 Всего пользователей: *${totalUsers}*`;
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
      `Привет, ${userName}!\\n\\n` +
      `🧬 МЕТОД БУТЕЙКО\\n\\n` +
      `Константин Павлович Бутейко — первый врач-физиолог, который доказал связь между неправильным дыханием и развитием более 150 заболеваний.\\n\\n` +
      `✅ Что происходит при правильном дыхании:\\n` +
      `• Нормализуется уровень CO₂ в крови\\n` +
      `• Расширяются сосуды и бронхи\\n` +
      `• Улучшается кислородное питание тканей\\n` +
      `• Снижается спазм гладкой мускулатуры\\n\\n` +
      `📊 Доказанная эффективность:\\n` +
      `Метод признан Минздравом РФ и применяется в клинической практике с 1985 года.\\n\\n` +
      `🌟 Результаты зависят от вашей цели:\\n` +
      `• Снять стресс и напряжение — несколько минут практики\\n` +
      `• Улучшить сон и самочувствие — регулярная практика\\n` +
      `• Серьёзные изменения в здоровье — требуют времени и системного подхода\\n\\n` +
      `💪 Преимущества метода:\\n` +
      `• Естественный подход без лекарств\\n` +
      `• Безопасен при правильном освоении\\n` +
      `• Навык остаётся с вами на всю жизнь\\n` +
      `• Можно практиковать в любом месте\\n\\n` +
      `Выберите 🛒️ Купить курс в меню, чтобы ознакомиться с доступными программами.\\n\\n` +
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
    let message = '*Ваши покупки:*\\n\\n';

    orders.forEach((order, index) => {
      const product = products[order.productId];
      const orderDate = new Date(order.completedAt).toLocaleDateString();
      const orderNumber = order.orderId || `#${Date.now().toString().slice(-6)}`;

      message += `*${index + 1}. ${product.name}*\\n`;
      message += `🆔 Заказ: ${orderNumber}\\n`;
      message += `📅 Дата: ${orderDate}\\n`;
      message += `💳 Цена: ${product.price}\\n`;

      if (order.recordingSent) {
        message += `🎬 Запись консультации: ✅\\n`;
      }

      message += '\\n';
    });

    message += '\\nДля повторного доступа к материалам напишите [Александру](https://t.me/AS_Popov87)';

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
        'У вас пока нет консультаций. Выберите 🛒️ Купить курс, чтобы приобрести индивидуальную консультацию.',
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
      order => order.productId === 'individual' || order.productId === 'package'
    );

    if (consultations.length === 0) {
      await ctx.reply(
        'У вас пока нет индивидуальных консультаций. Выберите 🛒️ Купить курс, чтобы приобрести консультацию.',
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

    let message = '*Ваши консультации:*\\n\\n';

    consultations.forEach((consultation, index) => {
      const product = products[consultation.productId];
      const orderDate = new Date(consultation.completedAt).toLocaleDateString();
      const orderNumber = consultation.orderId || `#${Date.now().toString().slice(-6)}`;

      message += `*${index + 1}. ${product.name}*\\n`;
      message += `🆔 Заказ: ${orderNumber}\\n`;
      message += `📅 Дата: ${orderDate}\\n`;

      if (consultation.recordingSent) {
        message += `🎬 Запись: ✅ [Доступна]\\n`;
        message += `🔗 Ссылка: ${consultation.recordingLink || 'Свяжитесь с преподавателем'}\\n`;
      } else {
        message += `🎬 Запись: ⏳ [Ожидает отправки]\\n`;
      }

      message += '\\n';
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

// Обработчик для обновления списка консультаций
bot.action('refresh_consultations', async (ctx) => {
  try {
    await bot.handleUpdate({
      ...ctx.update,
      callback_query: {
        ...ctx.callbackQuery,
        data: 'show_consultations'
      }
    });
  } catch (error) {
    console.error(`Ошибка при обновлении списка консультаций: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка при обновлении');
  }
});

// Обработчик для возврата в главное меню
bot.action('back_to_menu', async (ctx) => {
  try {
    const userName = getUserName(ctx.from);

    await ctx.editMessageText(
      `Выберите действие, ${userName}:`,
      mainKeyboard()
    );
    await ctx.answerCbQuery();
  } catch (error) {
    console.error(`Ошибка при возврате в меню: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Настройка маршрутов Express
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  const memoryUsage = process.memoryUsage();

  let pingStats = { status: 'not available' };
  try {
    if (global.botData.pingManager) {
      pingStats = global.botData.pingManager.getStats();
    }
  } catch (error) {
    console.error(`Ошибка при получении статистики пинга: ${error.message}`);
  }

  res.send(`
    <html>
      <head>
        <title>Breathing Practice Bot - Railway Edition</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 5px; margin-bottom: 10px; }
          .online { background-color: #d4edda; color: #155724; }
          .railway { background-color: #e3f2fd; color: #0d47a1; }
          h1 { color: #5682a3; }
          .info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
          .memory { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 15px; }
          .ping { background-color: #f8d7da; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Breathing Practice Bot</h1>
        <div class="status online">
          <strong>Status:</strong> Bot is running on Railway!
        </div>
        <div class="status railway">
          <strong>Mode:</strong> Railway Optimized (${RAILWAY_OPTIMIZED_MODE ? 'Enabled' : 'Disabled'})
        </div>
        <div class="info">
          <p><strong>Uptime:</strong> ${uptimeFormatted}</p>
          <p><strong>Started:</strong> ${startTime.toLocaleString()}</p>
          <p><strong>Last activity:</strong> ${global.botData.lastPingTime ? global.botData.lastPingTime.toLocaleString() : 'N/A'}</p>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Webhook URL:</strong> ${APP_URL}</p>
        </div>
        <div class="memory">
          <p><strong>Memory Usage:</strong></p>
          <p>RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB</p>
          <p>Heap Total: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB</p>
          <p>Heap Used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB</p>
        </div>
        <div class="ping">
          <p><strong>Ping Statistics:</strong></p>
          <p>Successful Pings: ${pingStats.successCount || 0}</p>
          <p>Failed Pings: ${pingStats.failureCount || 0}</p>
          <p>Current Interval: ${pingStats.currentInterval || 'default'} minutes</p>
          <p>Status: ${pingStats.isBackoff ? 'Backoff mode' : 'Normal'}</p>
          <p>Last Success: ${pingStats.lastSuccessTime ? new Date(pingStats.lastSuccessTime).toLocaleString() : 'N/A'}</p>
        </div>
      </body>
    </html>
  `);
  logWithTime(`Запрос к главной странице (uptime: ${uptimeFormatted})`);
});

app.get('/ping', (req, res) => {
  try {
    res.status(200).set('Content-Type', 'text/plain').send('pong');
    global.botData.lastPingTime = new Date();
  } catch (error) {
    console.error(`Ошибка при обработке ping-запроса: ${error.message}`);
    res.status(200).send('error, but still alive');
  }
});

app.get('/status', (req, res) => {
  try {
    const uptimeSeconds = Math.floor((new Date() - startTime) / 1000);
    const status = {
      status: 'ok',
      railway_optimized: RAILWAY_OPTIMIZED_MODE,
      uptime: uptimeSeconds,
      uptime_formatted: formatUptime(uptimeSeconds),
      startTime: startTime.toISOString(),
      currentTime: new Date().toISOString(),
      webhookMode: true,
      webhookUrl: APP_URL,
      port: PORT,
      platform: 'Railway',
      lastPingTime: global.botData.lastPingTime ? global.botData.lastPingTime.toISOString() : null,
      memory: process.memoryUsage(),
      memory_mb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      environment: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    try {
      if (global.botData.pingManager) {
        status.ping_stats = global.botData.pingManager.getStats();
      }
    } catch (pingError) {
      status.ping_error = pingError.message;
    }

    res.json(status);
    logWithTime('Запрос статуса бота');
  } catch (error) {
    console.error(`Ошибка при обработке status-запроса: ${error.message}`);
    res.status(200).json({ status: 'error', message: error.message });
  }
});

app.get('/health', (req, res) => {
  try {
    const uptime = Math.floor((new Date() - startTime) / 1000);
    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'ok',
      uptime: formatUptime(uptime),
      memory: Math.round(memoryUsage.rss / 1024 / 1024) + " MB",
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });

    logWithTime('Запрос проверки здоровья');
  } catch (error) {
    console.error(`Ошибка при обработке health-запроса: ${error.message}`);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

async function startApp() {
  try {
    console.log(`Запуск Express сервера на порту ${PORT}...`);
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      logWithTime(`Express сервер запущен на порту ${PORT} и адресе 0.0.0.0`);
    });

    // ПРОСТО КАК В BREATHING-LEAD-BOT - bot.launch() без параметров!
    // Telegraf сам определит режим (webhook vs polling)
    try {
      await bot.launch();
      logWithTime('🚀 Бот успешно запущен через bot.launch() (как в breathing-lead-bot)');
    } catch (launchError) {
      console.error('❌ Ошибка при запуске бота:', launchError.message);
      throw launchError;
    }

    try {
      await setupBotCommands(bot);
      setupCommandHandlers(bot, require('./handlers').handleStart);
      logWithTime('Команды меню и обработчики успешно настроены');
    } catch (menuError) {
      logWithTime(`Ошибка при настройке команд меню: ${menuError.message}`);
    }

    if (APP_URL) {
      const pingManager = setupPing(APP_URL, 30, 3);
      global.botData.pingManager = pingManager;
      logWithTime(`Настроен улучшенный самопинг для ${APP_URL} с интервалом 30 минут`);
    }

    setupScheduler(bot, ADMIN_ID, RAILWAY_OPTIMIZED_MODE);

    if (ADMIN_ID && !DISABLE_RESTART_NOTIFICATIONS) {
      try {
        const botInfo = await bot.telegram.getMe();
        const memoryInfo = `Память: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;

        bot.telegram.sendMessage(
          ADMIN_ID,
          `🤖 Бот запущен на Railway!\\n\\nВремя запуска: ${new Date().toLocaleString()}\\nИмя бота: @${botInfo.username}\\nID бота: ${botInfo.id}\\nURL: ${APP_URL}\\nPORT: ${PORT}\\nРежим оптимизации: ${RAILWAY_OPTIMIZED_MODE ? 'Включен ✅' : 'Выключен ❌'}\\n${memoryInfo}`
        ).catch(e => console.warn('Не удалось отправить уведомление:', e.message));
      } catch (error) {
        console.error('Ошибка при отправке уведомления админу:', error.message);
      }
    }
  } catch (error) {
    console.error('Ошибка при запуске приложения:', error);
    logWithTime(`Ошибка при запуске приложения: ${error.message}`);
  }
}

process.once('SIGINT', () => {
  logWithTime('Получен сигнал SIGINT, останавливаем бота...');
  const memoryInfo = `Память при остановке: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
  logWithTime(memoryInfo);
  bot.stop('SIGINT');
  logWithTime('Бот остановлен по SIGINT');
});

process.once('SIGTERM', () => {
  logWithTime('Получен сигнал SIGTERM, останавливаем бота...');
  const memoryInfo = `Память при остановке: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
  logWithTime(memoryInfo);
  bot.stop('SIGTERM');
  logWithTime('Бот остановлен по SIGTERM');
});

// Запускаем приложение
startApp();
