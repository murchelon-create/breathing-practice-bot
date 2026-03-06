# 🔗 Ссылки для отслеживания источников

Этот файл содержит готовые ссылки на бота [@breathing_opros_bot](https://t.me/breathing_opros_bot) с метками для отслеживания источников клиентов.

## 🌐 Для сайта (byteyko_lending)

### Главный экран / Hero Section
```
https://t.me/breathing_opros_bot?start=website_hero
```

**HTML код для сайта:**
```html
<a href="https://t.me/breathing_opros_bot?start=website_hero" target="_blank" class="btn btn-primary">
  Записаться через Telegram
</a>
```

---

### Кнопки призыва к действию (CTA)
```
https://t.me/breathing_opros_bot?start=website_cta
```

**HTML код:**
```html
<a href="https://t.me/breathing_opros_bot?start=website_cta" target="_blank">
  🌬️ Начать занятия
</a>
```

---

### Подвал сайта (Footer)
```
https://t.me/breathing_opros_bot?start=website_footer
```

**HTML код:**
```html
<a href="https://t.me/breathing_opros_bot?start=website_footer" target="_blank">
  Связаться с нами
</a>
```

---

### Общая ссылка (если не важно конкретное место)
```
https://t.me/breathing_opros_bot?start=website
```

---

## 💬 Для Telegram канала @spokoinoe_dyhanie

```
https://t.me/breathing_opros_bot?start=telegram_channel
```

**Пример сообщения в канале:**
```
🌬️ Запишитесь на консультацию по дыхательной гимнастике!

👉 https://t.me/breathing_opros_bot?start=telegram_channel
```

Или с кнопкой (закреплённое сообщение):
```
🌬️ Дыхательная гимнастика по методу Бутейко

Записаться на консультацию:
👇 Нажмите на кнопку ниже
```
(добавьте inline-кнопку со ссылкой в редакторе Telegram)

---

## 📸 Для Instagram

```
https://t.me/breathing_opros_bot?start=instagram
```

**Пример для био:**
```
🌬️ Дыхательная гимнастика по методу Бутейко
👉 Запись на консультацию: t.me/breathing_opros_bot?start=instagram
```

---

## 🔵 Для ВКонтакте

```
https://t.me/breathing_opros_bot?start=vk
```

---

## 📺 Для YouTube

```
https://t.me/breathing_opros_bot?start=youtube
```

**Пример для описания видео:**
```
👉 Записаться на консультацию: https://t.me/breathing_opros_bot?start=youtube
```

---

## 👤 Прямая ссылка (для друзей/личных сообщений)

```
https://t.me/breathing_opros_bot?start=direct
```

---

## 📊 Как просмотреть статистику

Администратор может посмотреть статистику по источникам, отправив боту команду:

```
/stats
```

Пример ответа:
```
📊 Статистика по источникам:

🌐 Сайт: 45
💬 Telegram канал @spokoinoe_dyhanie: 23
📸 Instagram: 12
👤 Прямая ссылка: 8

👥 Всего пользователей: 88
```

---

## ℹ️ Как это работает

1. **Пользователь переходит** по ссылке `t.me/breathing_opros_bot?start=website`
2. **Бот сохраняет** источник `website` в базу данных
3. **При оформлении заказа** администратор видит:

```
🔔 НОВЫЙ ЗАКАЗ

📦 Продукт: Разовая консультация
💰 Цена: 5 000 ₽

👤 Клиент: Александр Попов
🆔 ID: 123456789
📧 Email: example@mail.ru
📱 Телефон: +79001234567
🌐 Источник: Сайт  ← ВОТ ОНО!
🕒 Время заказа: 6.03.2026, 08:20:15
```

---

## 🛠️ Рекомендации

- ✅ Используйте **разные метки** для разных кнопок/мест на сайте
- ✅ Проверяйте статистику через `/stats` раз в неделю
- ✅ Можно добавить новые источники (например, `?start=email_newsletter`)
- ✅ Для рекламных кампаний: `?start=ads_google` или `?start=ads_yandex`

---

**🚀 Готово к использованию!**

После редеплоя бота на Railway система отслеживания начнёт работать автоматически.
