## 本地影视管理系统（FilmManager）

一个基于 **FastAPI + SQLite + 原生 Vue3 + Element Plus** 的本地影视管理工具，用于在浏览器中整理、搜索和标注本地影视资源。

---

## 功能概览

- 影片管理
  - 新增 / 编辑 / 删除影片
  - 字段：编号、名称、年份、系列、演员、标签、评分、文件路径、海报路径、简介
  - 支持按名称、编号、演员搜索
  - 支持按标签筛选、按「最近添加 / 年份」排序
  - 首页卡片列表支持分页显示
- 标签管理
  - 影片支持多标签，多对多关系存储（`tags` + `film_tags`）
  - 可在影片详情 / 创建弹窗中选择或新建标签
  - 单独的标签管理页面：重命名 / 删除标签
  - 删除标签会同步清理 `film_tags` 中的关联
- 系列管理
  - 影片可以归属于一个系列
  - 系列列表页显示各系列及代表海报
  - 系列详情页展示该系列下所有影片
  - 支持在系列详情页删除系列（影片保留，仅清空其 `series_id`）
- 演员视图
  - 列出演员列表
  - 查看单个演员的影片
  - 编辑演员别名 / 头像路径
- 导航
  - 顶部菜单在四个模块之间切换：影片 / 演员 / 系列 / 标签

---

## 技术栈与运行方式

- 后端
  - Python 3
  - FastAPI
  - SQLite（纯文件，无外部服务依赖）
- 前端
  - Vue 3（CDN 引入，使用 Composition API）
  - Element Plus（CDN 引入）
- 依赖管理
  - `requirements.txt`：`fastapi` / `uvicorn` / `pydantic`
  - 启动脚本：`start.sh`（可选 Conda 环境 `filmmanager`）

### 启动后端

```bash
pip install -r requirements.txt
bash start.sh
```

启动后访问：

- API + 前端入口：`http://127.0.0.1:8000/`
- 前端静态资源目录：`/frontend`

---

## 目录结构与核心文件

```text
FilmManager/
  backend/
    main.py          # FastAPI 入口，挂载路由和前端静态文件
    database.py      # SQLite 初始化与连接
    films.py         # 影片相关 API
    actors.py        # 演员相关 API
    series.py        # 系列相关 API
    tags.py          # 标签相关 API
    schemas.py       # Pydantic 模型定义

  frontend/
    index.html       # SPA 入口，加载 Vue / Element Plus / 各页面脚本
    app.js           # 根组件与顶部导航
    films.js         # 主页：影片列表 + 详情 + 创建
    actors.js        # 演员页面
    series.js        # 系列页面
    tags.js          # 标签管理页面

  start.sh           # 开发时启动脚本（uvicorn）
  requirements.txt   # Python 依赖
  .gitignore         # 忽略 pycache 与数据库文件
```

---

## 数据库设计

数据库文件位于 `database/films.db`（目录在 `database.py` 中自动创建）。

### 主要表

定义见：[backend/database.py](file:///home/wy/Documents/FilmManager/backend/database.py)

- `films`
  - `id`：主键
  - `name`：影片名称
  - `code`：编号（会被规范化为大写）
  - `year`：年份
  - `actors`：演员文本（以分隔符存储）
  - `description`：简介
  - `poster_path`：海报路径
  - `file_path`：文件路径
  - `rating`：评分（浮点）
  - `series_id`：外键指向 `series.id`
  - `created_at`：创建时间

- `series`
  - `id`：主键
  - `name`：系列名称（唯一）
  - `created_at`：创建时间

- `actors`
  - `id`：主键
  - `name`：演员名称
  - `other_names`：别名
  - `avatar_path`：头像路径
  - `level`：等级（1~5，对应「夯 / 顶级 / 人上人 / NPC / 拉完了」）
  - `created_at`：创建时间

- `tags`
  - `id`：主键
  - `name`：标签名称（唯一）
  - `created_at`：创建时间

- `film_tags`
  - `film_id`：影片 ID
  - `tag_id`：标签 ID
  - 联合主键 `(film_id, tag_id)`，实现多对多关系

---

## 后端 API 概览

### 配置与入口（backend/main.py）

- 初始化数据库：`init_db()`（启动事件）
- 路由：
  - `/api/films`       → 影片相关
  - `/api/actors`      → 演员相关
  - `/api/series`      → 系列相关
  - `/api/tags`        → 标签相关
- 静态文件与前端：
  - 挂载 `/frontend` 静态目录
  - 根路径 `/` 返回 `frontend/index.html`

### 影片 API（backend/films.py）

Pydantic 模型见：[backend/schemas.py](file:///home/wy/Documents/FilmManager/backend/schemas.py)

- `GET /api/films`
  - 查询参数：
    - `q`：按名称模糊搜索
    - `code`：按编号模糊搜索（内部规范化为大写）
    - `actor`：按演员名匹配（支持在 `actors.name` 或 `other_names` 里找到真实名字后，再在 `films.actors` 字符串中匹配）
    - `tag`：按标签精确筛选（通过 `tags` / `film_tags` 关联）
    - `series`：按系列名称精确筛选
    - `sort_by`：`recent`（默认，按创建时间）或 `year`
  - 返回字段：
    - `tags`：通过 `GROUP_CONCAT(DISTINCT t.name)` 聚合出来的标签字符串
    - `series`：关联系列名称（`series_name`）

- `GET /api/films/{film_id}`
  - 返回单个影片详情，含聚合后的 `tags` 与 `series` 名称。

- `POST /api/films`
  - 请求体：`FilmCreate`
  - 行为：
    - 规范化 `code`（转大写）
    - `series`：
      - 调用 `get_or_create_series_id`，若系列名不存在则在 `series` 表中自动创建
    - `tags`：
      - 调用 `sync_tags_for_film`：
        - 删除该影片在 `film_tags` 中的旧关联
        - 解析标签文本（支持 `;` 或 `,`，去重、去空）
        - 对每个标签名，如果不存在则插入 `tags` 表，然后写入 `film_tags`

- `PUT /api/films/{film_id}`
  - 请求体：`FilmUpdate`（所有字段可选）
  - 更新逻辑：
    - 若请求中包含 `series` 字段：
      - 调用 `get_or_create_series_id` 更新 / 创建系列，再写入 `series_id`
    - 若请求中包含 `tags` 字段：
      - 调用 `sync_tags_for_film` 重建 `film_tags` 关联（支持清空标签）
    - 若请求中包含 `actors` 字段：
      - 调用 `ensure_actors_exist` 把新演员写入 `actors` 表

- `DELETE /api/films/{film_id}`
  - 删除影片前先清理 `film_tags` 中记录。

### 系列 API（backend/series.py）

- `GET /api/series`
  - 返回所有系列列表：
    - `id`
    - `name`
    - `poster_path`：通过子查询，选取该系列下最新影片的海报路径（若无影片则为 `NULL`）

- `DELETE /api/series/{series_id}`
  - 若系列不存在 → 404 `"系列不存在"`
  - 行为：
    - `UPDATE films SET series_id = NULL WHERE series_id = ?`
    - `DELETE FROM series WHERE id = ?`

### 标签 API（backend/tags.py）

- `GET /api/tags`
  - 按名称排序返回所有标签。

- `PUT /api/tags/{tag_id}`
  - 重命名标签：
    - 新名称去空白后不能为空
    - 不允许与其它标签重名

- `DELETE /api/tags/{tag_id}`
  - 若标签不存在 → 404 `"标签不存在"`
  - 删除前清理 `film_tags` 中对应关联。

### 演员 API（backend/actors.py）

- `GET /api/actors`
  - 可选查询参数 `q` 按名称 / 别名模糊搜索。

- `POST /api/actors`
  - 创建演员，字段：`name`、`other_names`、`avatar_path`。

- `GET /api/actors/{actor_id}`
  - 获取演员详情。

- `PUT /api/actors/{actor_id}`
  - 更新演员的 `name` / `other_names` / `avatar_path`。

- `DELETE /api/actors/{actor_id}`
  - 删除演员本身（与影片的关系目前通过影片中的 `actors` 文本字段维护）。

---

## 前端结构与交互

### 入口与布局（frontend/index.html & app.js）

- `index.html`
  - 引入 Element Plus 样式和 Vue / Element Plus 脚本（CDN）
  - 一些基础样式（`poster`、`film-title`、`film-meta`、`toolbar`）
  - 挂载点：`<div id="app"></div>`
  - 依次加载：
    - `films.js`
    - `actors.js`
    - `series.js`
    - `tags.js`
    - `app.js`

- `app.js`
  - 根组件 `App`：
    - 顶部 `el-menu` 切换当前模块：`films` / `actors` / `series` / `tags`
    - 根据 `currentPage` 显示对应页面组件：
      - `FilmPage`
      - `ActorPage`
      - `SeriesPage`
      - `TagPage`

### 影片页面（frontend/films.js）

主要包含两个组件：

1. `FilmDetailDialog`
   - 用于查看 / 编辑单个影片：
     - 字段编辑：编号 / 名称 / 年份 / 演员 / 标签 / 系列 / 评分 / 文件路径 / 海报路径 / 简介
     - `editMode` 控制是否可编辑
   - 标签选择弹窗：
     - 使用 `el-dialog` + `el-scrollbar` + `el-checkbox-group`
     - 支持输入新标签并立即加入当前影片和全局标签集合（后端在保存时持久化）
   - 系列选择弹窗：
     - 从 `/api/series` 加载系列列表
     - 支持直接输入新系列名并使用（保存影片时自动写入 `series` 表）

2. `FilmPage`
   - 主页卡片列表 + 查询 / 筛选 / 创建 / 分页：
     - 查询条件：
       - 按名称 / 编号 / 演员搜索
       - 按标签筛选
       - 按最近添加 / 年份排序
     - 分页：
       - `films`：完整列表
       - `currentPage` / `pageSize`：分页状态
       - `pagedFilms`：当前页数据（用在卡片 `v-for` 中）
       - 顶部卡片上方显示 `el-pagination`
     - 创建影片：
       - `createForm` 保存表单数据
       - 标签 / 系列弹窗逻辑与详情页类似

### 演员页面（frontend/actors.js）

- 演员列表视图：
  - 搜索栏：按名称模糊搜索演员
  - 列表：展示所有演员
- 演员详情视图：
  - 编辑演员别名与头像路径
  - 下方展示该演员参与的所有影片（通过 `/api/films?actor=...`）
  - 复用 `FilmDetailDialog` 编辑影片；保存 / 删除影片后自动刷新该演员的影片列表。

### 系列页面（frontend/series.js）

- 列表视图：
  - 展示所有系列卡片，卡片海报取自该系列最新影片的海报
  - 点击某个系列进入详情视图

- 详情视图：
  - 显示当前系列名称
  - 下方卡片列表展示该系列下所有影片
  - 复用 `FilmDetailDialog` 编辑影片；保存 / 删除影片后自动刷新当前系列的影片列表
  - 「删除当前系列」按钮：
    - 调用 `DELETE /api/series/{id}`
    - 删除后重新加载系列列表并返回列表视图
    - 相关影片不删除，只是清空其 `series_id`

### 标签页面（frontend/tags.js）

- 展示所有标签的表格
- 操作：
  - 重命名标签：
    - 弹出输入框修改名称
    - 调用 `PUT /api/tags/{id}`
  - 删除标签：
    - 确认后调用 `DELETE /api/tags/{id}`
    - 同时清除 `film_tags` 中的关联，影片本身保留

---

## 标签与系列的关键设计

- 标签（tags）
  - 不再使用 `films.tags` 文本列，而是通过 `tags` + `film_tags` 多对多表存储
  - 前端仍然用字符串展示标签（以 `"; "` 连接），兼容旧 UI
  - 后端统一通过 `sync_tags_for_film` 维护关系表
  - 查询时使用 `GROUP_CONCAT(DISTINCT t.name)` 聚合标签名称

- 系列（series）
  - 系列是独立资源表：`series(id, name, created_at)`
  - 每部影片通过 `series_id` 关联一个系列
  - 创建 / 编辑影片时，如果输入的系列名称不存在，会自动插入 `series` 表（懒创建）
  - 系列删除时不会删除影片，只会解除关联。

---

## 开发者提示

- 本项目不使用打包工具，前端通过 `<script>` 直接加载 `.js` 文件，因此修改前端代码后只需刷新浏览器即可生效。
- 数据库存放在 `database/films.db`，被 `.gitignore` 忽略，适合本地使用。
- 由于 `tags` 和 `series` 都采用“懒创建 + 自动关联”的方式，前端只需要维护好影片的 `tags`/`series` 字段，后端会自动维护对应的表结构和关系。
