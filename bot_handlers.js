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
  setupWebhook,
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

// Обновленный обработчик для информационного раздела
bot.action('show_info', async (ctx) => {
  try {
    // Используем функцию getUserName для получения имени пользователя
    const userName = getUserName(ctx.from);
    
    // Сначала отправляем логотип с подписью
    await ctx.replyWithPhoto(
      { source: 'files/logo.jpg' },
      { caption: '🌬️ Дыхательные практики Попова Александра - Информация о курсах' }
    );
    
    // Небольшая задержка для лучшего UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Отправляем основной текст
    await ctx.reply(
      `ℹ️ *О курсах дыхательных практик*\n\nПривет, ${userName}!\n\n*Попов Александр* - сертифицированный инструктор по дыхательной гимнастике Бутейко.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите \"🛍️ Купить курс\" в меню, чтобы ознакомиться с доступными программами.`,
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
    
    // Проверяем, есть ли у пользователя завершенные заказы
    if (!completedOrders[userId] || completedOrders[userId].length === 0) {
      await ctx.reply(
        messageTemplates.noPurchases,
        { reply_markup: mainKeyboard().reply_markup }
      );
      await ctx.answerCbQuery('У вас пока нет завершенных покупок');
      return;
    }
    
    // Если есть заказы, показываем их
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
        message += `🎬 Запись консультации: ✅\n`;
      }
      
      message += '\n';
    });
    
    message += '\nДля повторного доступа к материалам напишите в чат администратору.';
    
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
    
    // Проверяем, есть ли у пользователя консультации
    if (!completedOrders[userId] || completedOrders[userId].length === 0) {
      await ctx.reply(
        'У вас пока нет консультаций. Выберите "🛍️ Купить курс", чтобы приобрести индивидуальную консультацию.',
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
    
    // Фильтруем только консультации
    const consultations = completedOrders[userId].filter(
      order => order.productId === 'individual' || order.productId === 'package'
    );
    
    if (consultations.length === 0) {
      await ctx.reply(
        'У вас пока нет индивидуальных консультаций. Выберите "🛍️ Купить курс", чтобы приобрести консультацию.',
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
    
    // Если есть консультации, показываем их
    let message = '*Ваши консультации:*\n\n';
    
    consultations.forEach((consultation, index) => {
      const product = products[consultation.productId];
      const orderDate = new Date(consultation.completedAt).toLocaleDateString();
      const orderNumber = consultation.orderId || `#${Date.now().toString().slice(-6)}`;
      
      message += `*${index + 1}. ${product.name}*\n`;
      message += `🆔 Заказ: ${orderNumber}\n`;
      message += `📅 Дата: ${orderDate}\n`;
      
      if (consultation.recordingSent) {
        message += `🎬 Запись: ✅ [Доступна]\n`;
        message += `🔗 Ссылка: ${consultation.recordingLink || 'Свяжитесь с преподавателем'}\n`;
      } else {
        message += `🎬 Запись: ⏳ [Ожидает отправки]\n`;
      }
      
      message += '\n';
    });
    
    message += 'Для получения записи консультации или дополнительной информации, пожалуйста, свяжитесь с преподавателем.';
    
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
    // Повторно используем обработчик show_consultations
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
    // Получаем имя пользователя
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

// Главная страница с расширенной информацией для Railway
app.get('/', (req, res) => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);
  const memoryUsage = process.memoryUsage();
  
  // Получаем статистику пинга, если доступна
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

// Маршрут для проверки здоровья (важно для Railway)
app.get('/ping', (req, res) => {
  try {
    res.status(200).set('Content-Type', 'text/plain').send('pong');
    global.botData.lastPingTime = new Date();
  } catch (error) {
    console.error(`Ошибка при обработке ping-запроса: ${error.message}`);
    res.status(200).send('error, but still alive');
  }
});

// Расширенный маршрут для статуса с дополнительной информацией для Railway
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
    
    let webhookSetup = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!webhookSetup && attempts < maxAttempts) {
      attempts++;
      try {
        logWithTime(`Попытка настройки вебхука ${attempts}/${maxAttempts}`);
        webhookSetup = await setupWebhook();
        
        if (webhookSetup) {
          logWithTime(`Вебхук успешно настроен с ${attempts} попытки`);
        } else {
          logWithTime(`Не удалось настроить вебхук (попытка ${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        logWithTime(`Ошибка при настройке вебхука (попытка ${attempts}/${maxAttempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (webhookSetup) {
      logWithTime('Бот успешно настроен в режиме вебхука');
      
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
            `🤖 Бот запущен на Railway!\n\nВремя запуска: ${new Date().toLocaleString()}\nИмя бота: @${botInfo.username}\nID бота: ${botInfo.id}\nURL: ${APP_URL}\nPORT: ${PORT}\nРежим оптимизации: ${RAILWAY_OPTIMIZED_MODE ? 'Включен ✅' : 'Выключен ❌'}\n${memoryInfo}`
          ).catch(e => console.warn('Не удалось отправить уведомление:', e.message));
        } catch (error) {
          console.error('Ошибка при отправке уведомления админу:', error.message);
        }
      }
    } else {
      logWithTime('Не удалось настроить вебхук после нескольких попыток');
      console.error('Не удалось настроить вебхук после нескольких попыток');
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
  bot.telegram.deleteWebhook().then(() => { logWithTime('Вебхук удален'); });
  logWithTime('Бот остановлен по SIGINT');
});

process.once('SIGTERM', () => {
  logWithTime('Получен сигнал SIGTERM, останавливаем бота...');
  const memoryInfo = `Память при остановке: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`;
  logWithTime(memoryInfo);
  bot.telegram.deleteWebhook().then(() => { logWithTime('Вебхук удален'); });
  logWithTime('Бот остановлен по SIGTERM');
});

// Запускаем приложение
startApp();
