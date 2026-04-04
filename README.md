<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Globe.gl-000000?style=for-the-badge&logo=threedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
</p>

<h1 align="center">🌍 Travel Globe</h1>

<p align="center">
  <b>Персональная карта путешествий с интерактивным 3D-глобусом</b><br>
  Многопользовательское веб-приложение в стиле Apple iOS — минимализм, матовое стекло, плавные анимации.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

---

## Скриншоты

| 3D Глобус | 2D Карта | Список стран |
|:---------:|:--------:|:------------:|
| Интерактивный глобус с маркерами посещённых стран | Leaflet-карта с закрашенными странами и переключателем слоёв | Карточки с флагами, рейтингами и поиском |

---

## Возможности

### Карты
- **3D Глобус** (Globe.gl) — вращающийся глобус с маркерами-пинами
- **2D Карта** (Leaflet.js) — посещённые страны закрашены, переключатель «Минимализм» / «Спутник»
- Клик на маркер → боковая панель с деталями поездки

### Поездки
- Название страны, даты, посещённые города, описание, рейтинг ★★★★★
- Фотоальбом — автоматическая загрузка из **Яндекс Диска** (приватные папки и публичные ссылки)
- Лайтбокс для просмотра фотографий

### Пользователи
- Регистрация и авторизация (JWT-токены)
- Хеширование паролей (PBKDF2-SHA256)
- Каждый пользователь видит **только свои** поездки
- Роли: `user` и `admin`

### Навигация
- Всплывающее меню в стиле iOS (матовое стекло, `backdrop-filter: blur`)
- Вкладки: 3D Глобус → 2D Карта → Мои страны → Админ-панель
- Живой поиск по странам без перезагрузки страницы

### Админ-панель
- Статистика: количество пользователей и поездок
- Список всех пользователей с возможностью удаления
- Доступна только для `role == "admin"`

---

## 🛠 Технологии

| Слой | Технологии |
|------|-----------|
| **Frontend** | Vanilla JS, CSS (iOS Human Interface Guidelines) |
| **3D** | [Globe.gl](https://globe.gl/) + Three.js + TopoJSON |
| **2D** | [Leaflet.js](https://leafletjs.com/) + CartoDB / Esri тайлы |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) + SQLAlchemy |
| **База данных** | SQLite (переносится на PostgreSQL) |
| **Авторизация** | JWT (python-jose) + PBKDF2-SHA256 |
| **Фото** | [Яндекс Диск REST API](https://yandex.ru/dev/disk/) |

---

## Структура проекта

```
travel-globe/
├── main.py                # FastAPI — роуты, JWT, RBAC
├── database.py            # SQLAlchemy модели (User, Trip)
├── schemas.py             # Pydantic-схемы валидации
├── yadisk_service.py      # Сервис Яндекс Диск API
├── requirements.txt       # Python-зависимости
├── .env                   # Переменные окружения
├── .env.example           # Шаблон .env
├── travel.db              # SQLite (создаётся автоматически)
└── static/
    ├── index.html         # SPA — единственная HTML-страница
    ├── css/
    │   └── style.css      # iOS-дизайн: blur, shadows, animations
    └── js/
        ├── app.js         # Логика: глобус, карта, навигация, CRUD
        └── countries-data.js  # Справочник 130+ стран
```

---

## Быстрый старт

### Требования

- Python 3.10+
- pip

### Установка

```bash
# Клонируем репозиторий
git clone https://github.com/your-username/travel-globe.git
cd travel-globe

# Создаём виртуальное окружение (рекомендуется)
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# Устанавливаем зависимости
pip install -r requirements.txt
```

### Настройка

```bash
# Копируем шаблон переменных окружения
cp .env.example .env            # Linux / macOS
copy .env.example .env          # Windows
```

Отредактируйте `.env`:

```env
SECRET_KEY=ваш-секретный-ключ-для-jwt
ADMIN_USERNAME=admin
ADMIN_PASSWORD=надёжный-пароль
YANDEX_DISK_TOKEN=ваш-oauth-токен
DATABASE_URL=sqlite:///./travel.db
```

### Запуск

```bash
python main.py
```

Откройте **http://localhost:8000** в браузере.

---

## 🔑 Получение токена Яндекс Диска

1. Создайте приложение на [oauth.yandex.ru](https://oauth.yandex.ru/)
2. Платформа → **Веб-сервисы**, Redirect URI оставьте по умолчанию
3. Доступы → отметьте **Чтение всего Диска** (`cloud_api:disk.read`)
4. Получите токен на [Полигоне Яндекс Диска](https://yandex.ru/dev/disk/poligon/) или по ссылке:

```
https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_CLIENT_ID
```

5. Вставьте токен в `.env` → `YANDEX_DISK_TOKEN`

В форме поездки укажите путь:
- Приватная папка: `/Photos/Japan`
- Публичная ссылка: `https://disk.yandex.ru/d/abc123` (токен не нужен)

---

## API

### Аутентификация

| Метод | Эндпоинт | Описание |
|:-----:|----------|----------|
| `POST` | `/api/register` | Регистрация нового пользователя |
| `POST` | `/api/login` | Вход (возвращает JWT) |
| `GET` | `/api/me` | Текущий пользователь |

### Поездки (требуют JWT)

| Метод | Эндпоинт | Описание |
|:-----:|----------|----------|
| `GET` | `/api/trips` | Список поездок текущего пользователя |
| `GET` | `/api/trips/{id}` | Детали поездки |
| `POST` | `/api/trips` | Создать поездку |
| `PUT` | `/api/trips/{id}` | Обновить поездку |
| `DELETE` | `/api/trips/{id}` | Удалить поездку |
| `GET` | `/api/trips/{id}/photos` | Фотографии из Яндекс Диска |

### Админ (требуют `role == "admin"`)

| Метод | Эндпоинт | Описание |
|:-----:|----------|----------|
| `GET` | `/api/admin/users` | Список всех пользователей |
| `DELETE` | `/api/admin/users/{id}` | Удалить пользователя |
| `GET` | `/api/admin/stats` | Статистика (юзеры, поездки) |

---

## Переход на PostgreSQL

```env
DATABASE_URL=postgresql://user:password@localhost:5432/travel_globe
```

```bash
pip install psycopg2-binary
```

Таблицы создадутся автоматически при запуске.

---

## Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t travel-globe .
docker run -p 8000:8000 --env-file .env travel-globe
```

---

<p align="center">
  <sub>Сделано с ❤️ для тех, кто любит путешествовать</sub>
</p>
