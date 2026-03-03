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
  { command: 'buy', description: 'Купить курс или консультацию' },
  { command: 'info', description: 'Информация о курсах' },
  { command: 'purchases', description: 'Мои покупки' },
  { command: 'consultations', description: 'Мои консультации' },
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
    // Устанавливаем команды для всех чатов с ботом
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
  // Обработчик /start уже настроен в основном коде
  // Но на всякий случай добавляем явно
  bot.command('start', handleStart);
  
  // Обработчик команды /buy - показывает список доступных продуктов
  bot.command('buy', async (ctx) => {
    try {
      // Получаем имя пользователя
      const userName = getUserName(ctx.from);
      
      await ctx.reply(
        `📚 Выберите продукт, ${userName}:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔰 Стартовый комплект - 990 ₽', callback_data: 'buy_starter' }],
              [{ text: '👤 Индивидуальное занятие - 2 000 ₽', callback_data: 'buy_individual' }],
              [{ text: '🎯 Пакет 3 занятия - 4500 ₽', callback_data: 'buy_package' }],
              [{ text: '🏆 Полный курс видеоуроков - 14 999 ₽ [🔄 В разработке]', callback_data: 'product_in_development' }],
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

  // Обработчик команды /info - показывает информацию о курсах
  bot.command('info', async (ctx) => {
    try {
      // Получаем имя пользователя
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
        `ℹ️ *О курсах дыхательных практик*\n\nПривет, ${userName}!\n\n*Попов Александр* - инструктор по дыхательной гимнастике Бутейко.\n\nНаши курсы помогут вам:\n\n• Повысить жизненную энергию\n• Снизить уровень стресса\n• Улучшить качество сна\n• Повысить иммунитет\n• Улучшить работу дыхательной системы\n\nВыберите /buy в меню, чтобы ознакомиться с доступными программами.`,
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

  // Обработчик команды /purchases - показывает покупки пользователя
  bot.command('purchases', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { completedOrders } = global.botData;
      
      // Проверяем, есть ли у пользователя завершенные заказы
      if (!completedOrders[userId] || completedOrders[userId].length === 0) {
        await ctx.reply(
          messageTemplates.noPurchases,
          { reply_markup: mainKeyboard().reply_markup }
        );
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
      
      logWithTime(`Пользователь ${userId} просмотрел свои покупки через команду /purchases`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /purchases: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // Обработчик команды /consultations - показывает консультации пользователя
  bot.command('consultations', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { completedOrders } = global.botData;
      
      // Проверяем, есть ли у пользователя консультации
      if (!completedOrders[userId] || completedOrders[userId].length === 0) {
        await ctx.reply(
          'У вас пока нет консультаций. Выберите /buy, чтобы приобрести индивидуальную консультацию.',
          { 
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            } 
          }
        );
        return;
      }
      
      // Фильтруем только консультации
      const consultations = completedOrders[userId].filter(
        order => order.productId === 'individual' || order.productId === 'package'
      );
      
      if (consultations.length === 0) {
        await ctx.reply(
          'У вас пока нет индивидуальных консультаций. Выберите /buy, чтобы приобрести консультацию.',
          { 
            reply_markup: {
              ...mainKeyboard().reply_markup,
              remove_keyboard: true
            } 
          }
        );
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
      
      logWithTime(`Пользователь ${userId} просмотрел свои консультации через команду /consultations`);
    } catch (error) {
      console.error(`Ошибка при обработке команды /consultations: ${error.message}`);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже или нажмите /start для перезапуска бота.');
    }
  });

  // Обработчик команды /contact - отправляет контакт преподавателя
  bot.command('contact', async (ctx) => {
    try {
      // Получаем имя пользователя
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

  // Обработчик команды /help - показывает справку
  bot.command('help', async (ctx) => {
    try {
      // Получаем имя пользователя
      const userName = getUserName(ctx.from);
      
      await ctx.reply(
        `🌬️ *Дыхательные практики Попова Александра*\n\nПривет, ${userName}!\n\nДоступные команды:\n\n` +
        '• /start - Начать работу с ботом\n' +
        '• /buy - Купить курс или консультацию\n' +
        '• /info - Информация о курсах\n' +
        '• /purchases - Мои покупки\n' +
        '• /consultations - Мои консультации\n' +
        '• /contact - Связаться с преподавателем\n' +
        '• /help - Получить эту справку\n\n' +
        'Если у вас возникли вопросы, вы всегда можете связаться с Александром напрямую: @AS_Popov87',
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
