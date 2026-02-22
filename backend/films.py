from typing import List, Optional
import sqlite3
import re

from fastapi import APIRouter, HTTPException, Query

from .database import get_connection
from .schemas import Film, FilmCreate, FilmUpdate


router = APIRouter()


def row_to_film(row: sqlite3.Row) -> Film:
    return Film(
        id=row[0],
        name=row[1],
        code=row[2],
        year=row[3],
        tags=row[4],
        series=row[5],
        actors=row[6],
        description=row[7],
        poster_path=row[8],
        file_path=row[9],
        rating=row[10],
    )


def ensure_actors_exist(connection: sqlite3.Connection, actors_text: str) -> None:
    parts = re.split(r"[;,]", actors_text)
    names = []
    for part in parts:
        name = part.strip()
        if name:
            names.append(name)
    seen = set()
    unique_names = []
    for name in names:
        if name not in seen:
            seen.add(name)
            unique_names.append(name)
    for name in unique_names:
        exists_cursor = connection.execute(
            "SELECT 1 FROM actors WHERE name = ? LIMIT 1",
            (name,),
        )
        if exists_cursor.fetchone() is None:
            connection.execute(
                """
                INSERT INTO actors (name, other_names, avatar_path)
                VALUES (?, ?, ?)
                """,
                (name, None, None),
            )


def normalize_code(code: Optional[str]) -> Optional[str]:
    if code is None:
        return None
    return code.upper()


def get_or_create_series_id(connection: sqlite3.Connection, name: Optional[str]) -> Optional[int]:
    if not name:
        return None
    cursor = connection.execute(
        "SELECT id FROM series WHERE name = ?",
        (name,),
    )
    row = cursor.fetchone()
    if row is not None:
        return row[0]
    cursor = connection.execute(
        "INSERT INTO series (name) VALUES (?)",
        (name,),
    )
    return cursor.lastrowid


def sync_tags_for_film(connection: sqlite3.Connection, film_id: int, tags_text: Optional[str]) -> None:
    connection.execute(
        "DELETE FROM film_tags WHERE film_id = ?",
        (film_id,),
    )
    if not tags_text:
        return
    parts = re.split(r"[;,]", tags_text)
    names = []
    for part in parts:
        name = part.strip()
        if name:
            names.append(name)
    seen = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        cursor = connection.execute(
            "SELECT id FROM tags WHERE name = ?",
            (name,),
        )
        row = cursor.fetchone()
        if row is None:
            cursor = connection.execute(
                "INSERT INTO tags (name) VALUES (?)",
                (name,),
            )
            tag_id = cursor.lastrowid
        else:
            tag_id = row[0]
        connection.execute(
            "INSERT OR IGNORE INTO film_tags (film_id, tag_id) VALUES (?, ?)",
            (film_id, tag_id),
        )


@router.get("/api/films", response_model=List[Film])
def list_films(
    q: Optional[str] = Query(default=None, description="按名称模糊搜索"),
    code: Optional[str] = Query(default=None, description="按编号模糊搜索"),
    actor: Optional[str] = Query(default=None, description="按演员模糊搜索"),
    tag: Optional[str] = Query(default=None, description="按标签模糊搜索"),
    series: Optional[str] = Query(default=None, description="按系列精确筛选"),
    sort_by: str = Query(default="recent", description="排序方式: recent 或 year"),
) -> List[Film]:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        sql = """
        SELECT
            f.id,
            f.name,
            f.code,
            f.year,
            GROUP_CONCAT(DISTINCT t.name) AS tags,
            s.name AS series_name,
            f.actors,
            f.description,
            f.poster_path,
            f.file_path,
            f.rating
        FROM films f
        LEFT JOIN series s ON f.series_id = s.id
        LEFT JOIN film_tags ft ON ft.film_id = f.id
        LEFT JOIN tags t ON t.id = ft.tag_id
        """
        conditions = []
        params: List[object] = []
        join_tags = False

        actor_names: Optional[List[str]] = None
        if actor:
            actor_cursor = connection.execute(
                "SELECT name FROM actors WHERE name LIKE ? OR other_names LIKE ?",
                (f"%{actor}%", f"%{actor}%"),
            )
            actor_rows = actor_cursor.fetchall()
            if actor_rows:
                actor_names = [row[0] for row in actor_rows]

        if q:
            conditions.append("name LIKE ?")
            params.append(f"%{q}%")
        if code:
            normalized_code = normalize_code(code)
            conditions.append("code LIKE ?")
            params.append(f"%{normalized_code}%")
        if actor_names:
            sub_conditions = []
            for name in actor_names:
                sub_conditions.append("actors LIKE ?")
                params.append(f"%{name}%")
            conditions.append("(" + " OR ".join(sub_conditions) + ")")
        elif actor:
            conditions.append("actors LIKE ?")
            params.append(f"%{actor}%")
        if tag:
            join_tags = True
            conditions.append("t.name = ?")
            params.append(tag)
        if series:
            conditions.append("s.name = ?")
            params.append(series)

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        sql += """
        GROUP BY
            f.id,
            f.name,
            f.code,
            f.year,
            s.name,
            f.actors,
            f.description,
            f.poster_path,
            f.file_path,
            f.rating
        """

        if sort_by == "year":
            sql += " ORDER BY f.year IS NULL, f.year DESC, f.created_at DESC"
        else:
            sql += " ORDER BY f.created_at DESC"

        cursor = connection.execute(sql, params)
        rows = cursor.fetchall()
        return [row_to_film(row) for row in rows]
    finally:
        connection.close()


@router.get("/api/films/{film_id}", response_model=Film)
def get_film(film_id: int) -> Film:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            """
            SELECT
                f.id,
                f.name,
                f.code,
                f.year,
                GROUP_CONCAT(DISTINCT t.name) AS tags,
                s.name AS series_name,
                f.actors,
                f.description,
                f.poster_path,
                f.file_path,
                f.rating
            FROM films f
            LEFT JOIN series s ON f.series_id = s.id
            LEFT JOIN film_tags ft ON ft.film_id = f.id
            LEFT JOIN tags t ON t.id = ft.tag_id
            WHERE f.id = ?
            GROUP BY
                f.id,
                f.name,
                f.code,
                f.year,
                s.name,
                f.actors,
                f.description,
                f.poster_path,
                f.file_path,
                f.rating
            """,
            (film_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="未找到该影视条目")
        return row_to_film(row)
    finally:
        connection.close()


@router.post("/api/films", response_model=Film)
def create_film(film: FilmCreate) -> Film:
    connection = get_connection()
    try:
        code_value = normalize_code(film.code)
        series_id = get_or_create_series_id(connection, film.series)
        cursor = connection.execute(
            """
            INSERT INTO films (name, code, year, series_id, actors, description, poster_path, file_path, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                film.name,
                code_value,
                film.year,
                series_id,
                film.actors,
                film.description,
                film.poster_path,
                film.file_path,
                film.rating,
            ),
        )
        film_id = cursor.lastrowid
        if film.actors:
            ensure_actors_exist(connection, film.actors)
        if film.tags:
            sync_tags_for_film(connection, film_id, film.tags)
        connection.commit()
    finally:
        connection.close()
    return get_film(film_id)


@router.put("/api/films/{film_id}", response_model=Film)
def update_film(film_id: int, film: FilmUpdate) -> Film:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "SELECT COUNT(1) FROM films WHERE id = ?",
            (film_id,),
        )
        exists = cursor.fetchone()[0]
        if not exists:
            raise HTTPException(status_code=404, detail="未找到该影视条目")

        fields = []
        params: List[object] = []
        update_data = film.dict(exclude_unset=True)
        actors_value = update_data.get("actors")
        tags_present = "tags" in update_data
        tags_value = update_data.pop("tags", None)
        series_present = "series" in update_data
        series_name = update_data.pop("series", None)
        if series_present:
            if series_name is None or series_name == "":
                update_data["series_id"] = None
            else:
                series_id = get_or_create_series_id(connection, series_name)
                update_data["series_id"] = series_id
        if "code" in update_data:
            update_data["code"] = normalize_code(update_data["code"])

        for field_name, value in update_data.items():
            fields.append(f"{field_name} = ?")
            params.append(value)

        if not fields:
            return get_film(film_id)

        params.append(film_id)
        sql = f"UPDATE films SET {', '.join(fields)} WHERE id = ?"
        connection.execute(sql, params)
        if actors_value:
            ensure_actors_exist(connection, actors_value)
        if tags_present:
            sync_tags_for_film(connection, film_id, tags_value)
        connection.commit()
    finally:
        connection.close()
    return get_film(film_id)


@router.delete("/api/films/{film_id}")
def delete_film(film_id: int) -> None:
    connection = get_connection()
    try:
        connection.execute(
            "DELETE FROM film_tags WHERE film_id = ?",
            (film_id,),
        )
        cursor = connection.execute(
            "DELETE FROM films WHERE id = ?",
            (film_id,),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="未找到该影视条目")
    finally:
        connection.close()
