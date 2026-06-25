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
    const names = { trial: 'Видеоурок', intensive: 'Недельный интенсив', course: 'Курс 5 занятий' };
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
    const isVideoLesson = order.productId === 'trial';

    // Фото с поздравлением
    try {
      await bot.telegram.sendPhoto(clientId, { source: 'files/logo.jpg' }, { caption: '🎉 Оплата подтверждена!' });
      await new Promise(r => setTimeout(r, 800));
    } catch (e) { /* фото может отсутствовать */ }

    if (isVideoLesson) {
      // ============================================================
      // ВИДЕОУРОК: автоматическая отправка доступа
      // ============================================================
      const videoLink = product.videoLink; // Ссылка хранится в data.js → products.trial.videoLink

      if (videoLink) {
        // Ссылка уже задана — отправляем сразу
        await bot.telegram.sendMessage(
          clientId,
          `🎉 *Оплата подтверждена!*\n\n` +
          `Спасибо за покупку: *${product.name}*\n\n` +
          `🎥 Ваш видеоурок готов!\n` +
          `Продолжительность: 40 минут — смотрите в удобное время:\n\n` +
          `🔗 ${videoLink}\n\n` +
          `✅ ID заказа: #${orderId}\n\n` +
          `Если есть вопросы — пишите [Александру](https://t.me/AS_Popov87)`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎥 Смотреть видеоурок', url: videoLink }],
                [{ text: '✉️ Написать Александру', url: 'https://t.me/AS_Popov87' }]
              ]
            }
          }
        );
        logWithTime(`[VIDEO] Ссылка на видеоурок отправлена пользователю ${clientId}`);
      } else {
        // Ссылка ещё не задана — админ отправит вручную
        await bot.telegram.sendMessage(
          clientId,
          `🎉 *Оплата подтверждена!*\n\n` +
          `Спасибо за покупку: *${product.name}*\n\n` +
          `🎥 Ссылка на видеоурок будет отправлена вам в течение 24 часов.\n\n` +
          `✅ ID заказа: #${orderId}\n\n` +
          `Если есть вопросы — пишите [Александру](https://t.me/AS_Popov87)`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✉️ Написать Александру', url: 'https://t.me/AS_Popov87' }]
              ]
            }
          }
        );
        // Предупреждаем админа, чтобы отправил ссылку вручную
        await bot.telegram.sendMessage(
          ADMIN_ID,
          `⚠️ Ссылка на видеоурок не задана!\n\n` +
          `Пользователь ${clientId} купил Видеоурок — отправьте ссылку вручную.\n\n` +
          `Чтобы автоматизировать: заполните поле videoLink в data.js`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎥 Отправить ссылку клиенту', callback_data: `send_recording_${clientId}` }]
              ]
            }
          }
        );
        logWithTime(`[VIDEO] videoLink = null, админ предупреждён для ${clientId}`);
      }
    } else {
      // Остальные продукты — прежняя логика
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
    }

    // Сохраняем в завершённые
    if (!completedOrders[clientId]) completedOrders[clientId] = [];
    completedOrders[clientId].push({
      ...order,
      completedAt: new Date().toISOString(),
      status: 'completed',
      orderId,
      videoLinkSent: isVideoLesson && !!product.videoLink
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
