import os
import hashlib
import hmac
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from database import User, Trip, get_db, init_db
from schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    TripCreate, TripResponse, TripUpdate,
)
from yadisk_service import get_photos_from_yadisk

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 72
security = HTTPBearer(auto_error=False)


# Хеширование паролей (SHA-256 + salt) 
def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$")
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(h, expected.hex())
    except Exception:
        return False


# JWT 
def create_token(user_id: int, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "username": username, "role": role, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Невалидный токен")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Нет доступа")
    return user


# Lifespan 
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Создаём админа, если не существует
    from database import SessionLocal
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            password_hash=hash_password(os.getenv("ADMIN_PASSWORD", "admin123")),
            role="admin"
        )
        db.add(admin)
        db.commit()
    db.close()
    yield


app = FastAPI(title="Travel Globe API v2", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# Регистрация / Вход
@app.post("/api/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Имя уже занято")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.username, user.role)
    return TokenResponse(
        access_token=token, user_id=user.id,
        username=user.username, role=user.role,
    )


@app.post("/api/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_token(user.id, user.username, user.role)
    return TokenResponse(
        access_token=token, user_id=user.id,
        username=user.username, role=user.role,
    )


@app.get("/api/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


# Поездки текущего пользователя 
@app.get("/api/trips", response_model=list[TripResponse])
def list_my_trips(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.date_from.desc()).all()


@app.get("/api/trips/{trip_id}", response_model=TripResponse)
def get_trip(trip_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    return trip


@app.get("/api/trips/{trip_id}/photos")
async def get_trip_photos(trip_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    if not trip.yadisk_path:
        return []
    return await get_photos_from_yadisk(trip.yadisk_path)


@app.post("/api/trips", response_model=TripResponse, status_code=201)
def create_trip(body: TripCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = Trip(**body.model_dump(), user_id=user.id)
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@app.put("/api/trips/{trip_id}", response_model=TripResponse)
def update_trip(trip_id: int, body: TripUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(trip, key, value)
    db.commit()
    db.refresh(trip)
    return trip


@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.user_id == user.id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Поездка не найдена")
    db.delete(trip)
    db.commit()
    return {"deleted": trip_id}


# Админ: все пользователи 
@app.get("/api/admin/users", response_model=list[UserResponse])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить себя")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


@app.get("/api/admin/stats")
def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_trips = db.query(Trip).count()
    return {"total_users": total_users, "total_trips": total_trips}


# Статика
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/admin")
@app.get("/login")
@app.get("/register")
@app.get("/")
def serve_index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)