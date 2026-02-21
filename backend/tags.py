from typing import List
import sqlite3

from fastapi import APIRouter, HTTPException

from .database import get_connection
from .schemas import Tag


router = APIRouter()


def row_to_tag(row: sqlite3.Row) -> Tag:
    return Tag(
        id=row[0],
        name=row[1],
    )


@router.get("/api/tags", response_model=List[Tag])
def list_tags() -> List[Tag]:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            "SELECT id, name FROM tags ORDER BY name COLLATE NOCASE"
        )
        rows = cursor.fetchall()
        return [row_to_tag(row) for row in rows]
    finally:
        connection.close()


@router.put("/api/tags/{tag_id}", response_model=Tag)
def rename_tag(tag_id: int, tag: Tag) -> Tag:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "SELECT name FROM tags WHERE id = ?",
            (tag_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="标签不存在")
        new_name = tag.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="标签名称不能为空")
        cursor = connection.execute(
            "SELECT id FROM tags WHERE name = ? AND id != ?",
            (new_name, tag_id),
        )
        conflict = cursor.fetchone()
        if conflict is not None:
            raise HTTPException(status_code=400, detail="已存在同名标签")
        connection.execute(
            "UPDATE tags SET name = ? WHERE id = ?",
            (new_name, tag_id),
        )
        connection.commit()
    finally:
        connection.close()
    return Tag(id=tag_id, name=tag.name)


@router.delete("/api/tags/{tag_id}")
def delete_tag(tag_id: int) -> None:
    connection = get_connection()
    try:
        cursor = connection.execute(
            "SELECT 1 FROM tags WHERE id = ?",
            (tag_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="标签不存在")
        connection.execute(
            "DELETE FROM film_tags WHERE tag_id = ?",
            (tag_id,),
        )
        connection.execute(
            "DELETE FROM tags WHERE id = ?",
            (tag_id,),
        )
        connection.commit()
    finally:
        connection.close()
