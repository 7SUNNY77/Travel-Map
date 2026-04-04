import os
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime,
    ForeignKey, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./travel.db")
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Модель пользователя 
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(16), default="user")  # "user" | "admin"
    created_at = Column(DateTime, default=datetime.utcnow)

    trips = relationship("Trip", back_populates="owner", cascade="all, delete-orphan")


# Модель поездки 
class Trip(Base):
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    country_name = Column(String(128), nullable=False)
    country_code = Column(String(3), nullable=False)
    flag_emoji = Column(String(8), default="")
    date_from = Column(String(16), nullable=False)
    date_to = Column(String(16), nullable=False)
    cities = Column(Text, default="")
    description = Column(Text, default="")
    rating = Column(Integer, default=5)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    yadisk_path = Column(String(512), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="trips")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()