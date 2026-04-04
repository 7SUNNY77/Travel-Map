from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


#  Auth 
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True


# Trips
class TripCreate(BaseModel):
    country_name: str = Field(..., min_length=1, max_length=128)
    country_code: str = Field(..., min_length=2, max_length=3)
    flag_emoji: str = ""
    date_from: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    date_to: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    cities: str = ""
    description: str = ""
    rating: int = Field(5, ge=1, le=5)
    lat: float
    lng: float
    yadisk_path: str = ""


class TripUpdate(BaseModel):
    country_name: Optional[str] = None
    country_code: Optional[str] = None
    flag_emoji: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    cities: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    lat: Optional[float] = None
    lng: Optional[float] = None
    yadisk_path: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    country_name: str
    country_code: str
    flag_emoji: str
    date_from: str
    date_to: str
    cities: str
    description: str
    rating: int
    lat: float
    lng: float
    yadisk_path: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True