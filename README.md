<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Globe.gl-000000?style=for-the-badge&logo=threedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
</p>

<h1 align="center">🌍 Travel Globe</h1>

<p align="center">
  <b>Personal travel map with an interactive 3D globe</b><br>
  Multi-user web app built with  minimalism, frosted glass, smooth animations.<br><br>
  🚀 <b><a href="https://travel-map-4lbh.onrender.com/">Try the Live Demo</a></b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

---

| 3D Globe | 2D Map | Countries List |
|:--------:|:------:|:--------------:|
| Interactive globe with trip markers | Leaflet map with colored countries & layer toggle | Cards with flags, ratings, and live search |

---

## Features

### Maps
- **3D Globe** (Globe.gl) — slowly rotating globe with pin markers for visited countries
- **2D Map** (Leaflet.js) — visited countries highlighted in blue, toggle between **Grayscale** and **Satellite** tile layers
- Click any marker → side panel slides in with full trip details

### Trips
- Country name, travel dates, visited cities, description, star rating ★★★★★
- Photo gallery — auto-loaded from **Yandex Disk** (private folders & public links)
- Lightbox for full-screen photo viewing

### Users & Auth
- Registration and login with JWT tokens
- Password hashing (PBKDF2-SHA256)
- Each user sees **only their own** trips — full data isolation
- Roles: `user` and `admin`

### Navigation
- Floating menu with iOS-style frosted glass effect (`backdrop-filter: blur`)
- Tabs: 3D Globe → 2D Map → My Countries → Admin Panel
- Real-time search filtering without page reload

### Admin Panel
- Dashboard with total users and trips count
- User management — view all accounts, delete users
- Accessible only when `role == "admin"`

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vanilla JS, CSS (iOS Human Interface Guidelines) |
| **3D** | [Globe.gl](https://globe.gl/) + Three.js + TopoJSON |
| **2D** | [Leaflet.js](https://leafletjs.com/) + CartoDB / Esri tiles |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) + SQLAlchemy |
| **Database** | SQLite (easily migrates to PostgreSQL) |
| **Auth** | JWT (python-jose) + PBKDF2-SHA256 |
| **Photos** | [Yandex Disk REST API](https://yandex.ru/dev/disk/) |

---

## Project Structure

```
travel-globe/
├── main.py                # FastAPI app — routes, JWT, RBAC
├── database.py            # SQLAlchemy models (User, Trip)
├── schemas.py             # Pydantic validation schemas
├── yadisk_service.py      # Yandex Disk API service
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables
├── .env.example           # Template for .env
├── travel.db              # SQLite database (auto-created)
└── static/
    ├── index.html         # SPA — single HTML page
    ├── css/
    │   └── style.css      # iOS design: blur, shadows, animations
    └── js/
        ├── app.js         # Core logic: globe, map, nav, CRUD
        └── countries-data.js  # 130+ countries reference
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/travel-globe.git
cd travel-globe

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
```

### Configuration

```bash
cp .env.example .env            # Linux / macOS
copy .env.example .env          # Windows
```

Edit `.env`:

```env
SECRET_KEY=your-secret-key-for-jwt
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password
YANDEX_DISK_TOKEN=your-oauth-token
DATABASE_URL=sqlite:///./travel.db
```

### Run

```bash
python main.py
```

Open **http://localhost:8000** in your browser.

Default admin credentials: `admin` / `admin123` (change in `.env`).

---

## 🔑 Yandex Disk Setup

1. Create an app at [oauth.yandex.ru](https://oauth.yandex.ru/)
2. Platform → **Web services**, keep default Redirect URI
3. Permissions → enable **Read all of Disk** (`cloud_api:disk.read`)
4. Get your token at the [Yandex Disk Polygon](https://yandex.ru/dev/disk/poligon/) or via:

```
https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
```

5. Paste the token into `.env` → `YANDEX_DISK_TOKEN`

When adding a trip, specify the photo source:
- Private folder: `/Photos/Japan`
- Public link: `https://disk.yandex.ru/d/abc123` (no token needed)

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|:------:|----------|-------------|
| `POST` | `/api/register` | Register a new user |
| `POST` | `/api/login` | Log in (returns JWT) |
| `GET` | `/api/me` | Get current user info |

### Trips (require JWT)

| Method | Endpoint | Description |
|:------:|----------|-------------|
| `GET` | `/api/trips` | List current user's trips |
| `GET` | `/api/trips/{id}` | Get trip details |
| `POST` | `/api/trips` | Create a trip |
| `PUT` | `/api/trips/{id}` | Update a trip |
| `DELETE` | `/api/trips/{id}` | Delete a trip |
| `GET` | `/api/trips/{id}/photos` | Get photos from Yandex Disk |

### Admin (require `role == "admin"`)

| Method | Endpoint | Description |
|:------:|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `DELETE` | `/api/admin/users/{id}` | Delete a user |
| `GET` | `/api/admin/stats` | Get stats (users, trips) |

---

## Switching to PostgreSQL

Update `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/travel_globe
```

Install the driver:

```bash
pip install psycopg2-binary
```

Tables are created automatically on first run.

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
  <sub>Built with ❤️ for those who love to travel</sub>
</p>
