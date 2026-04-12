// Файл: handlers.js
// Обработчики для Telegram бота

const { logWithTime, getUserName } = require('./utils');
const { products, messageTemplates } = require('./data');

// Обработчик команды /start и кнопки "Начать"
async function handleStart(ctx) {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'друг';
    
    // Определяем источник и выбранный продукт
    let source = 'direct';
    let selectedProduct = null;
    
    // Проверяем наличие payload (deep linking)
    const payload = ctx.startPayload;
    if (payload) {
      const rawSource = payload;
      
      // 🎯 ПАРСИМ КОМБИНИРОВАННЫЕ МЕТКИ (websiteCtaTrial → websiteCta + Trial)
      if (rawSource.startsWith('websiteCta')) {
        // Извлекаем название продукта после websiteCta
        const productPart = rawSource.replace('websiteCta', '');
        // Преобразуем Trial/Intensive/Package5 в trial/intensive/package5
        selectedProduct = productPart.charAt(0).toLowerCase() + productPart.slice(1);
        source = rawSource; // Сохраняем полную метку для статистики
        
        logWithTime(`[START] Распознана комбинированная метка: источник=websiteCta, продукт=${selectedProduct}`);
      } else {
        source = rawSource;
        logWithTime(`[START] Обычный источник: ${source}`);
      }
    }
    
    // Инициализируем данные бота
    if (!global.botData) {
      global.botData = {
        pendingOrders: {},
        completedOrders: {},
        userSources: {}
      };
    }
    
    // Сохраняем источник пользователя
    if (!global.botData.userSources) {
      global.botData.userSources = {};
    }
    
    if (!global.botData.userSources[userId]) {
      global.botData.userSources[userId] = {
        source: source,
        firstSeen: new Date().toISOString(),
        firstName: firstName
      };
      logWithTime(`[START] ✨ Новый пользователь ${userId} (${firstName}) из источника: websiteCta, выбрал продукт: ${selectedProduct}`);
    } else {
      logWithTime(`[START] 🔄 Возвращающийся пользователь ${userId} (${firstName}), источник: ${source}`);
    }
    
    // Формируем приветственное сообщение
    const welcomeMessage = messageTemplates.welcome(firstName);
    
    // Отправляем приветственное сообщение с главным меню
    const { mainKeyboard } = require('./utils');
    await ctx.reply(welcomeMessage, mainKeyboard());
    
    // Если выбран конкретный продукт — сразу показываем его
    if (selectedProduct && products[selectedProduct]) {
      await new Promise(resolve => setTimeout(resolve, 800));
      await showProductInfo(ctx, selectedProduct);
    }
    
    // Уведомляем администратора о новом пользователе
    const adminMessage = formatAdminNotification(userId, firstName, source, selectedProduct);
    await sendAdminNotification(ctx, adminMessage);
    
    logWithTime(`[START] Пользователь ${userId} (${firstName}) запустил бота`);
  } catch (error) {
    console.error(`[START] Ошибка: ${error.message}`);
    logWithTime(`[START] ❌ Ошибка при обработке команды start: ${error.message}`);
    await ctx.reply('Произошла ошибка при запуске бота. Пожалуйста, попробуйте позже.');
  }
}

// Показываем информацию о продукте
async function showProductInfo(ctx, productId) {
  try {
    const product = products[productId];
    if (!product) {
      logWithTime(`[PRODUCT] Продукт не найден: ${productId}`);
      return;
    }
    
    await ctx.reply(
      product.fullDescription,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: `💳 Записаться — ${product.price}`, callback_data: `buy_${productId}` }]
          ]
        }
      }
    );
    
    logWithTime(`[PRODUCT] Показана информация о продукте: ${productId}`);
  } catch (error) {
    console.error(`[PRODUCT] Ошибка: ${error.message}`);
  }
}

// Форматируем уведомление для администратора
function formatAdminNotification(userId, firstName, source, selectedProduct) {
  let adminMessage = `🆕 Новый пользователь:\n- ID: ${userId}\n- Имя: ${firstName}\n- Источник: ${source}`;
  
  // 🎯 Добавляем информацию о выбранном продукте если есть
  if (selectedProduct) {
    const productNames = {
      trial: 'Пробное занятие',
      intensive: 'Недельный интенсив',
      package5: 'Курс 5 занятий'
    };
    const productName = productNames[selectedProduct] || selectedProduct;
    adminMessage += `\n- Выбран продукт: ${productName} 🎯`;
  }
  
  return adminMessage;
}

// Отправляем уведомление администратору
async function sendAdminNotification(ctx, message) {
  try {
    const { ADMIN_IDS } = require('./config');
    if (!ADMIN_IDS || ADMIN_IDS.length === 0) return;
    
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId, message);
      } catch (err) {
        logWithTime(`[ADMIN] Не удалось отправить уведомление admin ${adminId}: ${err.message}`);
      }
    }
  } catch (error) {
    logWithTime(`[ADMIN] Ошибка при отправке уведомления: ${error.message}`);
  }
}

module.exports = {
  handleStart,
  showProductInfo,
  formatAdminNotification,
  sendAdminNotification
};
