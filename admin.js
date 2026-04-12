// Файл: admin.js

const { products, messageTemplates } = require('./data');
const { mainKeyboard, fileExists, logWithTime } = require('./utils');
const { bot, ADMIN_ID } = require('./config');

function getSourceEmoji(source) {
  if (source && source.startsWith('websiteCta')) return '🌐';
  const map = { website: '🌐', telegram_channel: '💬', telegram_group: '💬', instagram: '📸', vk: '🔵', youtube: '📺', direct: '👤', unknown: '❓' };
  return map[source] || '❓';
}

function formatSource(source) {
  if (source && source.startsWith('websiteCta')) {
    const key = source.replace('websiteCta', '').toLowerCase();
    const names = { trial: 'Пробное занятие', intensive: 'Недельный интенсив', course: 'Курс 5 занятий' };
    return `Сайт (CTA) → ${names[key] || key}`;
  }
  const map = { website: 'Сайт', website_hero: 'Сайт (главный экран)', website_footer: 'Сайт (подвал)', telegram_channel: 'Telegram канал', telegram_group: 'Telegram группа', instagram: 'Instagram', vk: 'ВКонтакте', youtube: 'YouTube', direct: 'Прямая ссылка', unknown: 'Неизвестно' };
  return map[source] || source || 'Неизвестно';
}

async function confirmPayment(clientId) {
  try {
    const { pendingOrders, completedOrders } = global.botData;
    const order = pendingOrders[clientId];

    if (!order) {
      await bot.telegram.sendMessage(ADMIN_ID, '❌ Заказ не найден.');
      return;
    }

    const product = products[order.productId];
    const orderId = Date.now().toString().slice(-6);

    // Фото с поздравлением
    try {
      await bot.telegram.sendPhoto(clientId, { source: 'files/logo.jpg' }, { caption: '🎉 Оплата подтверждена!' });
      await new Promise(r => setTimeout(r, 800));
    } catch (e) { /* фото может отсутствовать */ }

    // Сообщение пользователю
    await bot.telegram.sendMessage(
      clientId,
      `🎉 *Оплата подтверждена!*\n\n` +
      `Спасибо за покупку: *${product.name}*\n\n` +
      `Александр свяжется с вами в ближайшее время для согласования времени занятий.\n\n` +
      `✅ ID заказа: #${orderId}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✉️ Написать Александру', url: 'https://t.me/AS_Popov87' }]
          ]
        }
      }
    );

    // Сохраняем в завершённые
    if (!completedOrders[clientId]) completedOrders[clientId] = [];
    completedOrders[clientId].push({
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed',
      orderId
    });
    delete pendingOrders[clientId];

    await bot.telegram.sendMessage(ADMIN_ID, `✅ Оплата подтверждена для ${clientId}. Продукт: ${product.name}. Заказ: #${orderId}`);
    logWithTime(`[ADMIN] Заказ #${orderId} подтверждён для ${clientId}`);
  } catch (error) {
    console.error(`confirmPayment ошибка: ${error.message}`);
    try { await bot.telegram.sendMessage(ADMIN_ID, `❌ Ошибка confirmPayment: ${error.message}`); } catch (e) {}
  }
}

async function sendConsultationRecording(clientId, recordingLink) {
  try {
    const { completedOrders } = global.botData;
    const orders = (completedOrders[clientId] || []).filter(o => o.status === 'completed');
    if (orders.length === 0) {
      await bot.telegram.sendMessage(ADMIN_ID, `❌ Нет завершённых заказов для ${clientId}`);
      return false;
    }
    const latest = orders.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

    await bot.telegram.sendMessage(
      clientId,
      `🎥 Запись вашего занятия готова!\n\n🔗 ${recordingLink}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎥 Смотреть запись', url: recordingLink }]
          ]
        }
      }
    );

    latest.recordingSent = true;
    latest.recordingLink = recordingLink;

    await bot.telegram.sendMessage(ADMIN_ID, `✅ Запись отправлена клиенту ${clientId}`);
    return true;
  } catch (error) {
    console.error(`sendConsultationRecording: ${error.message}`);
    try { await bot.telegram.sendMessage(ADMIN_ID, `❌ Ошибка при отправке записи: ${error.message}`); } catch(e) {}
    return false;
  }
}

module.exports = { confirmPayment, sendConsultationRecording };
