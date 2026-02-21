from typing import List
import sqlite3

from fastapi import APIRouter

from .database import get_connection
from .schemas import Series


router = APIRouter()


def row_to_series(row: sqlite3.Row) -> Series:
    return Series(
        id=row[0],
        name=row[1],
        poster_path=row[2],
    )


@router.get("/api/series", response_model=List[Series])
def list_series() -> List[Series]:
    connection = get_connection()
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            """
            SELECT
                s.id,
                s.name,
                (
                    SELECT f.poster_path
                    FROM films f
                    WHERE f.series_id = s.id
                    ORDER BY f.created_at DESC
                    LIMIT 1
                ) AS poster_path
            FROM series s
            ORDER BY s.name COLLATE NOCASE
            """
        )
        rows = cursor.fetchall()
        return [row_to_series(row) for row in rows]
    finally:
        connection.close()
