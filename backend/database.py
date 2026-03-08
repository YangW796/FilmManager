from pathlib import Path
import sqlite3


ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "database" / "films.db"
FRONTEND_DIR = ROOT_DIR / "frontend"


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS films (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT,
                year INTEGER,
                actors TEXT,
                description TEXT,
                poster_path TEXT,
                file_path TEXT,
                rating REAL,
                series_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS actors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                other_names TEXT,
                avatar_path TEXT,
                level INTEGER,
                films_complete INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        actor_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(actors)")
        }
        if "films_complete" not in actor_columns:
            connection.execute(
                "ALTER TABLE actors ADD COLUMN films_complete INTEGER DEFAULT 0"
            )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS film_tags (
                film_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (film_id, tag_id)
            )
            """
        )
        connection.commit()
    finally:
        connection.close()


def get_connection() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH)
