from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .database import FRONTEND_DIR, init_db
from .films import router as films_router
from .actors import router as actors_router


app = FastAPI(title="Local Film Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    print("后端服务已启动，可访问 http://127.0.0.1:8000/ 查看本地影视库")


app.include_router(films_router)
app.include_router(actors_router)


if FRONTEND_DIR.exists():
    app.mount(
        "/frontend",
        StaticFiles(directory=FRONTEND_DIR),
        name="frontend",
    )


@app.get("/", response_class=FileResponse)
def serve_index() -> FileResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="前端文件不存在")
    return FileResponse(index_path)
