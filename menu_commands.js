// Файл: menu_commands.js
// Настройка команд меню бота и их обработчиков

const { logWithTime } = require('./utils');
const { products, messageTemplates } = require('./data');
const { mainKeyboard, consultationsKeyboard, getUserName } = require('./utils');

/**
 * Определение команд, которые будут отображаться в меню бота
 */
const botCommands = [
  { command: 'start', description: 'Начать работу с ботом' },
  { command: 'buy', description: 'Записаться на занятие' },
  { command: 'info', description: 'Информация о методе и курсах' },
  { command: 'purchases', description: 'Мои покупки' },
  { command: 'consultations', description: 'Мои занятия' },
  { command: 'contact', description: 'Связаться с преподавателем' },
  { command: 'help', description: 'Получить помощь' }
];

/**
 * Настройка команд меню бота
 * @param {Object} bot - Экземпляр Telegram бота
 * @returns {Promise<boolean>} - Результат настройки команд
 */
async function setupBotCommands(bot) {
  try {
    await bot.telegram.setMyCommands(botCommands);
    logWithTime('✅ Команды меню бота успешно настроены');
    return true;
  } catch (error) {
    console.error(`Ошибка при настройке команд меню: ${error.message}`);
    logWithTime(`❌ Ошибка при настройке команд меню: ${error.message}`);
    return false;
  }
}

/**
 * Привязка обработчиков команд к боту
 * @param {Object} bot - Экземпляр Telegram бота
 * @param {Function} handleStart - Функция обработчик для команды start
 */
function setupCommandHandlers(bot, handleStart) {
  bot.command('start', handleStart);

  // /buy — список продуктов
  bot.command('buy', async (ctx) => {
    try {
      const userName = getUserName(ctx.from);

      await ctx.reply(
        `📚 Выберите формат занятий, ${userName}:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🟢 Видеоурок — 1 500 ₽', callback_data: 'buy_trial' }],
              [{ text: '🟡 Недельный интенсив — 14 000 ₽', callback_data: 'buy_intensive' }],
              [{ text: '🔵 Курс 5 занятий — 25 000 ₽', callback_data: 'buy_course' }],
              [{ text: '◀️ Назад', callback_data: 'back_to_menu' }]
            ]
          }
        }
      );

      logWithTime(`Пользователь ${ctx.from.id} открыл меню выбора продукта через команду /buy`);
    } catch (error) {
      console.error(`Ошибка в обработчике команды /buy: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // /info — информация о методе
  bot.command('info', async (ctx) => {
    try {
      const userName = getUserName(ctx.from);

      await ctx.replyWithPhoto(
        { source: 'files/logo.jpg' },
        { caption: '🌬️ Метод Бутейко — научно обоснованная дыхательная гимнастика' }
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
        `Метод признан Минздравом РФ и применяется в клинической практике с 1985 года.\n\n` +
        `🌟 Результаты зависят от вашей цели:\n` +
        `• Снять стресс и напряжение — несколько минут практики\n` +
        `• Улучшить сон и самочувствие — регулярная практика\n` +
        `• Серьёзные изменения в здоровье — требуют времени и системного подхода\n\n` +
        `💪 Преимущества метода:\n` +
        `• Естественный подход без лекарств\n` +
        `• Безопасен при правильном освоении\n` +
        `• Навык остаётся с вами на всю жизнь\n` +
        `• Можно практиковать в любом месте\n\n` +
        `📋 Форматы занятий:\n` +
        `• 🟢 Видеоурок — 1 500 ₽ (40 мин, поддержка в Telegram)\n` +
        `• 🟡 Недельный интенсив — 14 000 ₽ (7 дней × 30 мин)\n` +
        `• 🔵 Курс 5 занятий — 25 000 ₽ (5 × 45 мин, раз в неделю, 5 000 ₽/занятие)\n\n` +
        `Выберите /buy в меню, чтобы записаться.\n\n` +
        `📞 Связаться с преподавателем: [Александр Попов](https://t.me/AS_Popov87)`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );

      logWithTime(`Пользователь ${ctx.from.id} запросил информацию через команду /info`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /info: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // /purchases — покупки пользователя
  bot.command('purchases', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { completedOrders } = global.botData;

      if (!completedOrders[userId] || completedOrders[userId].length === 0) {
        await ctx.reply(
          messageTemplates.noPurchases,
          { reply_markup: mainKeyboard().reply_markup }
        );
        return;
      }

      const orders = completedOrders[userId];
      let message = '*Ваши покупки:*\n\n';

      orders.forEach((order, index) => {
        const product = products[order.productId];
        const orderDate = new Date(order.completedAt).toLocaleDateString();
        const orderNumber = order.orderId || `#${Date.now().toString().slice(-6)}`;

        message += `*${index + 1}. ${product ? product.name : order.productId}*\n`;
        message += `🆔 Заказ: ${orderNumber}\n`;
        message += `📅 Дата: ${orderDate}\n`;
        message += `💳 Цена: ${product ? product.price : '—'}\n`;

        if (order.recordingSent) {
          message += `🎬 Запись занятия: ✅\n`;
        }

        message += '\n';
      });

      message += '\nДля вопросов по занятиям напишите [Александру](https://t.me/AS_Popov87)';

      await ctx.reply(
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard().reply_markup
        }
      );

      logWithTime(`Пользователь ${userId} просмотрел свои покупки через команду /purchases`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /purchases: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // /consultations — занятия пользователя
  bot.command('consultations', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { completedOrders } = global.botData;

      if (!completedOrders[userId] || completedOrders[userId].length === 0) {
        await ctx.reply(
          'У вас пока нет занятий. Выберите /buy, чтобы записаться.',
          {
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            }
          }
        );
        return;
      }

      // Все продукты теперь — занятия (trial, intensive, course)
      const consultations = completedOrders[userId].filter(
        order => ['trial', 'intensive', 'course'].includes(order.productId)
      );

      if (consultations.length === 0) {
        await ctx.reply(
          'У вас пока нет занятий. Выберите /buy, чтобы записаться.',
          {
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            }
          }
        );
        return;
      }

      let message = '*Ваши занятия:*\n\n';

      consultations.forEach((consultation, index) => {
        const product = products[consultation.productId];
        const orderDate = new Date(consultation.completedAt).toLocaleDateString();
        const orderNumber = consultation.orderId || `#${Date.now().toString().slice(-6)}`;

        message += `*${index + 1}. ${product ? product.name : consultation.productId}*\n`;
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

      message += 'Для вопросов по занятиям свяжитесь с [Александром](https://t.me/AS_Popov87)';

      await ctx.reply(
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: consultationsKeyboard().reply_markup
        }
      );

      logWithTime(`Пользователь ${userId} просмотрел свои занятия через команду /consultations`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /consultations: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // /contact — контакт преподавателя
  bot.command('contact', async (ctx) => {
    try {
      const userName = getUserName(ctx.from);

      await ctx.reply(
        `📱 *Связаться с преподавателем*\n\nПривет, ${userName}!\n\nВы можете написать Александру напрямую по любым вопросам:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✉️ Написать Александру', url: 'https://t.me/AS_Popov87' }]
            ]
          }
        }
      );

      logWithTime(`Пользователь ${ctx.from.id} запросил контакт преподавателя через команду /contact`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /contact: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // /help — справка
  bot.command('help', async (ctx) => {
    try {
      const userName = getUserName(ctx.from);

      await ctx.reply(
        `🌬️ *Дыхательная гимнастика по методу Бутейко с Александром Поповым*\n\nПривет, ${userName}!\n\nДоступные команды:\n\n` +
        '• /start — Начать работу с ботом\n' +
        '• /buy — Записаться на занятие\n' +
        '• /info — Информация о методе и форматах занятий\n' +
        '• /purchases — Мои покупки\n' +
        '• /consultations — Мои занятия\n' +
        '• /contact — Связаться с преподавателем\n' +
        '• /help — Получить эту справку\n\n' +
        '📋 Форматы занятий:\n' +
        '• 🟢 Видеоурок — 1 500 ₽ (40 мин)\n' +
        '• 🟡 Недельный интенсив — 14 000 ₽\n' +
        '• 🔵 Курс 5 занятий — 25 000 ₽ (5 × 45 мин, раз в неделю)\n\n' +
        'Если у вас возникли вопросы, вы всегда можете связаться с [Александром](https://t.me/AS_Popov87)',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            ...mainKeyboard().reply_markup,
            remove_keyboard: true
          }
        }
      );

      logWithTime(`Пользователь ${ctx.from.id} запросил справку через команду /help`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /help: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  logWithTime('📋 Обработчики команд меню успешно настроены');
}

module.exports = {
  botCommands,
  setupBotCommands,
  setupCommandHandlers
};
