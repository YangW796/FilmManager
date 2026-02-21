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
        sql = "SELECT id, name, code, year, tags, series, actors, description, poster_path, file_path, rating FROM films"
        conditions = []
        params: List[object] = []

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
            conditions.append("code LIKE ?")
            params.append(f"%{code}%")
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
            conditions.append("tags LIKE ?")
            params.append(f"%{tag}%")
        if series:
            conditions.append("series = ?")
            params.append(series)

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        if sort_by == "year":
            sql += " ORDER BY year IS NULL, year DESC, created_at DESC"
        else:
            sql += " ORDER BY created_at DESC"

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
            "SELECT id, name, code, year, tags, series, actors, description, poster_path, file_path, rating FROM films WHERE id = ?",
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
        cursor = connection.execute(
            """
            INSERT INTO films (name, code, year, tags, series, actors, description, poster_path, file_path, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                film.name,
                film.code,
                film.year,
                film.tags,
                film.series,
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
        connection.commit()
    finally:
        connection.close()
    return get_film(film_id)


@router.delete("/api/films/{film_id}")
def delete_film(film_id: int) -> None:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "DELETE FROM films WHERE id = ?",
            (film_id,),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="未找到该影视条目")
    finally:
        connection.close()
