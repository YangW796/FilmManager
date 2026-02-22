from typing import List, Optional
import sqlite3

from fastapi import APIRouter, HTTPException, Query

from .database import get_connection
from .schemas import Actor, ActorCreate, ActorUpdate


router = APIRouter()


def row_to_actor(row: sqlite3.Row) -> Actor:
    return Actor(
        id=row[0],
        name=row[1],
        other_names=row[2],
        avatar_path=row[3],
        level=row[4],
    )


@router.get("/api/actors", response_model=List[Actor])
def list_actors(
    q: Optional[str] = Query(default=None, description="按名称模糊搜索"),
) -> List[Actor]:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        sql = "SELECT id, name, other_names, avatar_path, level FROM actors"
        params: List[object] = []
        if q:
            sql += " WHERE name LIKE ? OR other_names LIKE ?"
            keyword = f"%{q}%"
            params.extend([keyword, keyword])
        sql += " ORDER BY name COLLATE NOCASE"
        cursor = connection.execute(sql, params)
        rows = cursor.fetchall()
        return [row_to_actor(row) for row in rows]
    finally:
        connection.close()


@router.post("/api/actors", response_model=Actor)
def create_actor(actor: ActorCreate) -> Actor:
    connection = get_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO actors (name, other_names, avatar_path, level)
            VALUES (?, ?, ?, ?)
            """,
            (
                actor.name,
                actor.other_names,
                actor.avatar_path,
                actor.level,
            ),
        )
        connection.commit()
        actor_id = cursor.lastrowid
    finally:
        connection.close()
    return get_actor(actor_id)


@router.get("/api/actors/{actor_id}", response_model=Actor)
def get_actor(actor_id: int) -> Actor:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            "SELECT id, name, other_names, avatar_path, level FROM actors WHERE id = ?",
            (actor_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="未找到该演员")
        return row_to_actor(row)
    finally:
        connection.close()


@router.put("/api/actors/{actor_id}", response_model=Actor)
def update_actor(actor_id: int, actor: ActorUpdate) -> Actor:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "SELECT COUNT(1) FROM actors WHERE id = ?",
            (actor_id,),
        )
        exists = cursor.fetchone()[0]
        if not exists:
            raise HTTPException(status_code=404, detail="未找到该演员")

        fields = []
        params: List[object] = []

        for field_name, value in actor.dict(exclude_unset=True).items():
            fields.append(f"{field_name} = ?")
            params.append(value)

        if not fields:
            return get_actor(actor_id)

        params.append(actor_id)
        sql = f"UPDATE actors SET {', '.join(fields)} WHERE id = ?"
        connection.execute(sql, params)
        connection.commit()
    finally:
        connection.close()
    return get_actor(actor_id)


@router.delete("/api/actors/{actor_id}")
def delete_actor(actor_id: int) -> None:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "DELETE FROM actors WHERE id = ?",
            (actor_id,),
        )
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="未找到该演员")
    finally:
        connection.close()
