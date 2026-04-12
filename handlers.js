// Файл: handlers.js

const { logWithTime } = require('./utils');
const { products, messageTemplates } = require('./data');

async function handleStart(ctx) {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'друг';
    let source = 'direct';
    let selectedProduct = null;

    const payload = ctx.startPayload;
    if (payload) {
      if (payload.startsWith('websiteCta')) {
        const productPart = payload.replace('websiteCta', '');
        selectedProduct = productPart.charAt(0).toLowerCase() + productPart.slice(1);
        source = payload;
      } else {
        source = payload;
      }
    }

    if (!global.botData) {
      global.botData = { pendingOrders: {}, completedOrders: {}, userSources: {} };
    }
    if (!global.botData.userSources) global.botData.userSources = {};

    if (!global.botData.userSources[userId]) {
      global.botData.userSources[userId] = { source, firstSeen: new Date().toISOString(), firstName };
      logWithTime(`[START] ✨ Новый ${userId} (${firstName}) из: ${source}`);
    } else {
      logWithTime(`[START] 🔄 Возвращающийся ${userId} (${firstName})`);
    }

    const { mainKeyboard } = require('./utils');
    await ctx.reply(messageTemplates.welcome(firstName), mainKeyboard());

    if (selectedProduct && products[selectedProduct]) {
      await new Promise(r => setTimeout(r, 800));
      await showProductInfo(ctx, selectedProduct);
    }

    const adminMsg = formatAdminNotification(userId, firstName, source, selectedProduct);
    await sendAdminNotification(ctx, adminMsg);

    logWithTime(`[START] Пользователь ${userId} запустил бота`);
  } catch (error) {
    console.error(`[START] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

async function handleTextInput(ctx) {
  try {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (!global.botData) {
      global.botData = { pendingOrders: {}, completedOrders: {}, userSources: {} };
    }

    // Админ отправляет ссылку на запись
    if (global.botData.pendingRecordings?.[userId]) {
      const clientId = global.botData.pendingRecordings[userId];
      delete global.botData.pendingRecordings[userId];

      const orders = global.botData.completedOrders?.[clientId];
      if (orders && orders.length > 0) {
        orders[orders.length - 1].recordingSent = true;
        orders[orders.length - 1].recordingLink = text;
      }

      try {
        await ctx.telegram.sendMessage(
          parseInt(clientId),
          `🎥 Запись вашего занятия готова!\n\n🔗 ${text}`
        );
        await ctx.reply(`✅ Запись отправлена пользователю ${clientId}`);
      } catch (err) {
        await ctx.reply(`❌ Не удалось: ${err.message}`);
      }
      return;
    }

    // Пользователь оформляет заказ
    const pendingOrder = global.botData.pendingOrders?.[userId];
    if (pendingOrder) {
      const product = products[pendingOrder.productId];

      if (pendingOrder.step === 'email') {
        global.botData.pendingOrders[userId].email = text;
        global.botData.pendingOrders[userId].step = 'phone';
        // phoneRequest — это строка, не функция
        await ctx.reply(messageTemplates.phoneRequest, { reply_markup: { force_reply: true } });
        return;
      }

      if (pendingOrder.step === 'phone') {
        const orderId = `#${Date.now().toString().slice(-6)}`;
        const email = pendingOrder.email;
        const phone = text;

        global.botData.pendingOrders[userId] = { ...pendingOrder, phone, orderId, step: 'awaiting_payment' };

        await ctx.reply(
          `💳 *Оформление заказа ${orderId}*\n\n` +
          `📚 Продукт: ${product.name}\n` +
          `💰 Стоимость: ${product.price}\n\n` +
          `Александр свяжется с вами в ближайшее время для оплаты и согласования времени занятий.\n\n` +
          `📧 Email: ${email}\n📱 Телефон: ${phone}`,
          { parse_mode: 'Markdown' }
        );

        const { ADMIN_ID } = require('./config');
        try {
          await ctx.telegram.sendMessage(
            ADMIN_ID,
            `💰 Новый заказ ${orderId}\n` +
            `👤 ID: ${userId}\n` +
            `📚 Продукт: ${product.name}\n` +
            `💳 Цена: ${product.price}\n` +
            `📧 Email: ${email}\n` +
            `📱 Телефон: ${phone}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ Подтвердить оплату', callback_data: `confirm_payment_${userId}` }]
                ]
              }
            }
          );
        } catch (err) {
          logWithTime(`[ORDER] Не удалось уведомить админа: ${err.message}`);
        }

        logWithTime(`[ORDER] ${orderId} от ${userId} (${product.name})`);
        return;
      }
    }

    // Неизвестное сообщение
    const { mainKeyboard } = require('./utils');
    await ctx.reply('Не понял вас. Воспользуйтесь кнопками меню:', mainKeyboard());
  } catch (error) {
    console.error(`[TEXT] Ошибка: ${error.message}`);
    throw error;
  }
}

async function showProductInfo(ctx, productId) {
  try {
    const product = products[productId];
    if (!product) return;
    await ctx.reply(product.fullDescription, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Записаться — ${product.price}`, callback_data: `buy_${productId}` }]
        ]
      }
    });
  } catch (error) {
    console.error(`[PRODUCT] Ошибка: ${error.message}`);
  }
}

function formatAdminNotification(userId, firstName, source, selectedProduct) {
  const productNames = { trial: 'Пробное занятие', intensive: 'Недельный интенсив', course: 'Курс 5 занятий' };
  let msg = `🆕 Новый пользователь:\n- ID: ${userId}\n- Имя: ${firstName}\n- Источник: ${source}`;
  if (selectedProduct) msg += `\n- Продукт: ${productNames[selectedProduct] || selectedProduct} 🎯`;
  return msg;
}

async function sendAdminNotification(ctx, message) {
  try {
    const config = require('./config');
    const adminIds = config.ADMIN_IDS || (config.ADMIN_ID ? [config.ADMIN_ID] : []);
    for (const adminId of adminIds) {
      try { await ctx.telegram.sendMessage(adminId, message); }
      catch (err) { logWithTime(`[ADMIN] Не удалось: ${err.message}`); }
    }
  } catch (error) {
    logWithTime(`[ADMIN] Ошибка: ${error.message}`);
  }
}

module.exports = {
  handleStart,
  handleTextInput,
  showProductInfo,
  formatAdminNotification,
  sendAdminNotification
};
