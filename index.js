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

// ВАЖНО: Обработчик текстовых сообщений для email/телефона
bot.on('text', handleTextInput);

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
  console.log('========== УПРОЩЕННЫЙ ОБРАБОТЧИК ЗАПУЩЕН ==========')
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

// ОБРАБОТЧИК ПОДТВЕРЖДЕНИЯ ОПЛАТЫ (ДЛЯ АДМИНА)
bot.action(/confirm_payment_(.+)/, async (ctx) => {
  const clientId = parseInt(ctx.match[1]);
  const adminId = ctx.from.id;
  
  logWithTime(`[АДМИН] Админ ${adminId} подтверждает оплату для клиента ${clientId}`);
  
  try {
    // Проверяем, что это действительно админ
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.answerCbQuery('❌ У вас нет прав для этого действия');
      return;
    }
    
    await ctx.answerCbQuery('⚙️ Подтверждаю оплату...');
    
    // Вызываем функцию подтверждения оплаты
    await confirmPayment(clientId);
    
    // Проверяем, является ли это консультацией
    const order = pendingOrders[clientId] || completedOrders[clientId]?.[completedOrders[clientId].length - 1];
    const isConsultation = order && (order.productId === 'individual' || order.productId === 'package');
    
    // Заменяем кнопки на новые (НЕ УДАЛЯЕМ!)
    try {
      if (isConsultation) {
        // Для консультаций - кнопки для отправки записи
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [{ text: '🎬 Отправить запись консультации', callback_data: `send_recording_${clientId}` }],
            [{ text: '✅ Работа завершена, ожидается отзыв', callback_data: `work_completed_${clientId}` }],
            [{ text: '💬 Открыть чат с клиентом', url: `tg://user?id=${clientId}` }]
          ]
        });
      } else {
        // Для других продуктов - просто кнопка "Завершено"
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [{ text: '✅ Заказ завершён', callback_data: `order_completed_${clientId}` }]
          ]
        });
      }
    } catch (editError) {
      logWithTime(`[АДМИН] Не удалось заменить кнопки: ${editError.message}`);
    }
    
    logWithTime(`[АДМИН] Оплата успешно подтверждена для клиента ${clientId}`);
  } catch (error) {
    console.error(`[АДМИН] Ошибка при подтверждении оплаты: ${error.message}`);
    await ctx.answerCbQuery('❌ Ошибка при подтверждении');
  }
});

// ОБРАБОТЧИК ОТМЕНЫ ЗАКАЗА (ДЛЯ АДМИНА)
bot.action(/cancel_order_(.+)/, async (ctx) => {
  const clientId = parseInt(ctx.match[1]);
  const adminId = ctx.from.id;
  
  logWithTime(`[АДМИН] Админ ${adminId} отменяет заказ для клиента ${clientId}`);
  
  try {
    // Проверяем, что это действительно админ
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.answerCbQuery('❌ У вас нет прав для этого действия');
      return;
    }
    
    const order = pendingOrders[clientId];
    
    if (!order) {
      await ctx.answerCbQuery('❌ Заказ не найден');
      await bot.telegram.sendMessage(ADMIN_ID, '❌ Заказ не найден в списке ожидающих.');
      return;
    }
    
    const product = products[order.productId];
    
    // Удаляем заказ из ожидающих
    delete pendingOrders[clientId];
    
    // Уведомляем клиента
    await bot.telegram.sendMessage(
      clientId,
      `❌ Ваш заказ на "${product.name}" был отменён.\n\nЕсли у вас есть вопросы, пожалуйста, свяжитесь с [Александром](https://t.me/AS_Popov87).`,
      { 
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard().reply_markup 
      }
    );
    
    // Убираем кнопки с сообщения админа
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `❌ Заказ отменён:\nПродукт: ${product.name}\nКлиент ID: ${clientId}\nКлиент уведомлён об отмене.`
    );
    
    await ctx.answerCbQuery('✅ Заказ отменён');
    logWithTime(`[АДМИН] Заказ отменён для клиента ${clientId}`);
  } catch (error) {
    console.error(`[АДМИН] Ошибка при отмене заказа: ${error.message}`);
    await ctx.answerCbQuery('❌ Ошибка при отмене');
  }
});

// ОБРАБОТЧИК КНОПКИ "РАБОТА ЗАВЕРШЕНА" (С ПРОСЬБОЙ О ОТЗЫВЕ)
bot.action(/work_completed_(.+)/, async (ctx) => {
  const clientId = parseInt(ctx.match[1]);
  const adminId = ctx.from.id;
  
  try {
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.answerCbQuery('❌ У вас нет прав для этого действия');
      return;
    }
    
    // Отправляем клиенту просьбу о отзыве
    await bot.telegram.sendMessage(
      clientId,
      `⭐ Спасибо за работу с нами!\n\nЕсли вам всё понравилось, будем очень благодарны за ваш отзыв! 🙏\n\nВаше мнение поможет другим людям принять решение о начале занятий дыхательной гимнастикой.\n\nНапишите несколько слов о вашем опыте в личные сообщения [Александру](https://t.me/AS_Popov87). 🙌`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✉️ Написать отзыв', url: 'https://t.me/AS_Popov87' }]
          ]
        }
      }
    );
    
    // Убираем все кнопки с сообщения админа
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.answerCbQuery('✅ Работа с клиентом завершена. Просьба о отзыве отправлена.');
    
    // Уведомляем админа
    await bot.telegram.sendMessage(
      ADMIN_ID,
      `✅ Работа завершена для клиента (ID: ${clientId}).\nКлиенту отправлена просьба оставить отзыв.`
    );
    
    logWithTime(`[АДМИН] Работа завершена для клиента ${clientId}, отправлена просьба о отзыве`);
  } catch (error) {
    console.error(`[АДМИН] Ошибка: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// ОБРАБОТЧИК КНОПКИ "ОТПРАВИТЬ ЗАПИСЬ" (подготовка - админ введёт ссылку)
bot.action(/send_recording_(.+)/, async (ctx) => {
  const clientId = parseInt(ctx.match[1]);
  const adminId = ctx.from.id;
  
  try {
    if (adminId.toString() !== ADMIN_ID) {
      await ctx.answerCbQuery('❌ У вас нет прав для этого действия');
      return;
    }
    
    // Сохраняем состояние админа - ожидаем ссылку
    global.botData.adminState = {
      action: 'waiting_recording_link',
      clientId: clientId,
      timestamp: new Date().toISOString()
    };
    
    await ctx.reply(
      `🎬 Отправьте ссылку на запись консультации для клиента (ID: ${clientId})\n\nФормат: просто отправьте ссылку на видео (например, YouTube, Yandex.Disk и т.д.)`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.answerCbQuery('⌨️ Отправьте ссылку в чат...');
    logWithTime(`[АДМИН] Ожидается ссылка на запись для клиента ${clientId}`);
  } catch (error) {
    console.error(`[АДМИН] Ошибка: ${error.message}`);
    await ctx.answerCbQuery('Произошла ошибка');
  }
});

// Загружаем остальные обработчики из отдельного файла
require('./bot_handlers');

// ПРИМЕЧАНИЕ: Вебхук устанавливается автоматически через webhook callback в config.js
// Telegraf сам управляет вебхуком
