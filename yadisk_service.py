"""
yadisk_service.py — Сервис для работы с API Яндекс Диска.
Получает список изображений и прямые ссылки для скачивания.
"""

import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

YADISK_API = "https://cloud-api.yandex.net/v1/disk"
YADISK_PUBLIC_API = "https://cloud-api.yandex.net/v1/disk/public/resources"


def _get_token() -> str:
    return os.getenv("YANDEX_DISK_TOKEN", "")


def _is_public_link(path: str) -> bool:
    """Проверяет, является ли строка публичной ссылкой."""
    return path.startswith("https://") or path.startswith("http://")


def _is_image(name: str) -> bool:
    """Проверяет расширение файла."""
    return name.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"))


async def get_photos_from_yadisk(path: str, limit: int = 50) -> list[dict]:
    """
    Получает список фотографий из папки Яндекс Диска.

    :param path: Путь к папке на ЯД ("/Photos/Japan") или публичная ссылка
    :param limit: Максимальное количество фото
    :return: [{"name": "...", "preview": "...", "full": "..."}, ...]
    """
    if not path:
        return []

    token = _get_token()

    async with httpx.AsyncClient(timeout=15.0) as client:
        # ─── Публичная ссылка (не нужен токен) ──────────────
        if _is_public_link(path):
            return await _fetch_public(client, path, limit)

        # ─── Приватная папка (нужен OAuth-токен) ────────────
        if not token:
            return []
        return await _fetch_private(client, token, path, limit)


async def _fetch_public(
    client: httpx.AsyncClient, public_url: str, limit: int
) -> list[dict]:
    """Получаем файлы по публичной ссылке (без авторизации)."""
    params = {
        "public_key": public_url,
        "limit": limit,
        "preview_size": "M",      # Превью среднего размера
        "preview_crop": "false",
    }
    resp = await client.get(YADISK_PUBLIC_API, params=params)
    if resp.status_code != 200:
        return []

    data = resp.json()
    items = data.get("_embedded", {}).get("items", [])

    photos = []
    for item in items:
        if item.get("type") != "file" or not _is_image(item.get("name", "")):
            continue
        photos.append({
            "name": item["name"],
            "preview": item.get("preview", ""),
            "full": item.get("file", item.get("preview", "")),
        })

    return photos


async def _fetch_private(
    client: httpx.AsyncClient, token: str, folder_path: str, limit: int
) -> list[dict]:
    """Получаем файлы из приватной папки по OAuth-токену."""
    headers = {"Authorization": f"OAuth {token}"}

    # Шаг 1: Получить список файлов в папке
    params = {
        "path": folder_path,
        "limit": limit,
        "preview_size": "M",
        "preview_crop": "false",
    }
    resp = await client.get(
        f"{YADISK_API}/resources", params=params, headers=headers
    )
    if resp.status_code != 200:
        return []

    data = resp.json()
    items = data.get("_embedded", {}).get("items", [])

    photos = []
    for item in items:
        if item.get("type") != "file" or not _is_image(item.get("name", "")):
            continue

        # Шаг 2: Получить прямую ссылку на скачивание
        dl_params = {"path": item["path"]}
        dl_resp = await client.get(
            f"{YADISK_API}/resources/download", params=dl_params, headers=headers
        )
        full_url = ""
        if dl_resp.status_code == 200:
            full_url = dl_resp.json().get("href", "")

        photos.append({
            "name": item["name"],
            "preview": item.get("preview", ""),
            "full": full_url or item.get("preview", ""),
        })

    return photos