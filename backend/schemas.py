from typing import Optional

from pydantic import BaseModel


class FilmBase(BaseModel):
    name: str
    code: Optional[str] = None
    year: Optional[int] = None
    tags: Optional[str] = None
    series: Optional[str] = None
    actors: Optional[str] = None
    description: Optional[str] = None
    poster_path: Optional[str] = None
    file_path: Optional[str] = None
    rating: Optional[float] = None


class FilmCreate(FilmBase):
    pass


class FilmUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    year: Optional[int] = None
    tags: Optional[str] = None
    series: Optional[str] = None
    actors: Optional[str] = None
    description: Optional[str] = None
    poster_path: Optional[str] = None
    file_path: Optional[str] = None
    rating: Optional[float] = None


class Film(FilmBase):
    id: int

    class Config:
        orm_mode = True


class SeriesBase(BaseModel):
    name: str
    poster_path: Optional[str] = None


class Series(SeriesBase):
    id: int

    class Config:
        orm_mode = True


class TagBase(BaseModel):
    name: str
    poster_path: Optional[str] = None


class Tag(TagBase):
    id: int

    class Config:
        orm_mode = True


class ActorBase(BaseModel):
    name: str
    other_names: Optional[str] = None
    avatar_path: Optional[str] = None
    level: Optional[int] = None
    films_complete: bool = False


class ActorCreate(ActorBase):
    pass


class ActorUpdate(BaseModel):
    name: Optional[str] = None
    other_names: Optional[str] = None
    avatar_path: Optional[str] = None
    level: Optional[int] = None
    films_complete: Optional[bool] = None


class Actor(ActorBase):
    id: int

    class Config:
        orm_mode = True
