// 将标签字符串拆分为去重后的标签名称数组
function parseTagsText(text) {
  if (!text) {
    return []
  }
  const parts = text.split(/[;,]/)
  const result = []
  const seen = new Set()
  parts.forEach(part => {
    const name = part.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  })
  return result
}

// 影片详情弹窗组件，支持编辑基础信息、系列与标签
// 在主页、演员页、系列页复用
window.FilmDetailDialog = {
  name: "FilmDetailDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    film: {
      type: Object,
      required: true
    },
    tagOptions: {
      type: Array,
      default: () => []
    }
  },
  emits: ["update:modelValue", "saved", "deleted"],
  setup(props, { emit }) {
    // 是否处于可编辑模式
    const editMode = Vue.ref(false)
    // 系列选择弹窗相关状态
    const seriesDialogVisible = Vue.ref(false)
    const seriesSearch = Vue.ref("")
    const seriesOptions = Vue.ref([])
    const seriesLoading = Vue.ref(false)

    // 标签选择弹窗相关状态
    const tagDialogVisible = Vue.ref(false)
    const tagSearch = Vue.ref("")
    const tagAllTags = Vue.ref([])
    const tagSelected = Vue.ref([])

    // 系列搜索过滤
    const filteredSeries = Vue.computed(() => {
      const keyword = seriesSearch.value.trim().toLowerCase()
      if (!keyword) {
        return seriesOptions.value
      }
      return seriesOptions.value.filter(name =>
        name.toLowerCase().includes(keyword)
      )
    })

    // 标签搜索过滤
    const filteredTags = Vue.computed(() => {
      const keyword = tagSearch.value.trim().toLowerCase()
      const source = tagAllTags.value
      if (!keyword) {
        return source
      }
      return source.filter(name =>
        name.toLowerCase().includes(keyword)
      )
    })

    // 懒加载系列选项，只在第一次打开弹窗时请求
    const loadSeriesOptions = async () => {
      if (seriesOptions.value.length > 0) {
        return
      }
      seriesLoading.value = true
      try {
        const res = await fetch("/api/series")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        const data = await res.json()
        seriesOptions.value = data.map(s => s.name)
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载系列列表失败")
      } finally {
        seriesLoading.value = false
      }
    }

    // 打开系列选择弹窗，将当前系列填入搜索框
    const openSeriesDialog = async () => {
      if (!editMode.value) {
        return
      }
      seriesSearch.value = props.film.series || ""
      await loadSeriesOptions()
      seriesDialogVisible.value = true
    }

    // 直接选择某个系列
    const pickSeries = name => {
      props.film.series = name
      seriesDialogVisible.value = false
    }

    // 使用当前输入的系列名称（可创建新系列）
    const confirmSeries = () => {
      const value = seriesSearch.value.trim()
      const finalValue = value || null
      props.film.series = finalValue
      if (value && !seriesOptions.value.includes(value)) {
        seriesOptions.value.push(value)
      }
      seriesDialogVisible.value = false
    }

    // 清空系列，将当前影片从所属系列中移除
    const clearSeries = () => {
      props.film.series = null
      seriesSearch.value = ""
      seriesDialogVisible.value = false
    }

    // 打开标签选择弹窗，合并已有标签与外部传入的标签选项
    const openTagDialog = () => {
      if (!editMode.value) {
        return
      }
      const current = parseTagsText(props.film.tags)
      tagSelected.value = current
      const base = Array.isArray(props.tagOptions) ? props.tagOptions : []
      const merged = new Set()
      const list = []
      base.forEach(name => {
        const trimmed = name && name.trim()
        if (trimmed && !merged.has(trimmed)) {
          merged.add(trimmed)
          list.push(trimmed)
        }
      })
      current.forEach(name => {
        const trimmed = name && name.trim()
        if (trimmed && !merged.has(trimmed)) {
          merged.add(trimmed)
          list.push(trimmed)
        }
      })
      tagAllTags.value = list
      tagSearch.value = ""
      tagDialogVisible.value = true
    }

    // 在输入框中直接新增一个标签并选中
    const addTagFromInput = () => {
      const value = tagSearch.value.trim()
      if (!value) {
        return
      }
      if (!tagAllTags.value.includes(value)) {
        tagAllTags.value.push(value)
      }
      if (!tagSelected.value.includes(value)) {
        tagSelected.value.push(value)
      }
      tagSearch.value = ""
    }

    // 确认标签选择，将选中的标签写回 film.tags 文本
    const confirmTags = () => {
      const names = tagSelected.value
      props.film.tags = names.join("; ")
      tagDialogVisible.value = false
    }

    // 关闭详情弹窗并退出编辑模式
    const close = () => {
      emit("update:modelValue", false)
      editMode.value = false
    }

    // 进入编辑模式
    const enableEdit = () => {
      editMode.value = true
    }

    // 保存当前影片（详情弹窗里的保存，仅更新当前条目）
    const save = async () => {
      if (!props.film.id) {
        return
      }
      try {
        const res = await fetch("/api/films/" + props.film.id, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(props.film)
        })
        if (!res.ok) {
          throw new Error("保存失败")
        }
        ElementPlus.ElMessage.success("已保存")
        emit("saved")
        close()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("保存失败")
      }
    }

    // 删除当前影片
    const remove = async () => {
      if (!props.film.id) {
        return
      }
      try {
        await ElementPlus.ElMessageBox.confirm("确定要删除该影视条目吗？", "提示", {
          type: "warning"
        })
      } catch {
        return
      }
      try {
        const res = await fetch("/api/films/" + props.film.id, {
          method: "DELETE"
        })
        if (!res.ok) {
          throw new Error("删除失败")
        }
        ElementPlus.ElMessage.success("已删除")
        emit("deleted")
        close()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("删除失败")
      }
    }

    return {
      editMode,
      seriesDialogVisible,
      seriesSearch,
      seriesOptions,
      seriesLoading,
      filteredSeries,
      tagDialogVisible,
      tagSearch,
      tagAllTags,
      tagSelected,
      filteredTags,
      openSeriesDialog,
      pickSeries,
      confirmSeries,
      clearSeries,
      openTagDialog,
      addTagFromInput,
      confirmTags,
      close,
      enableEdit,
      save,
      remove
    }
  },
  template: `
    <div>
      <el-dialog
        :model-value="modelValue"
        title="详情"
        width="640px"
        @close="close"
      >
        <div
          v-if="film.poster_path"
          style="margin-bottom: 16px; text-align: center;"
        >
          <img
            :src="film.poster_path"
            alt=""
            style="max-width: 100%; height: auto;"
          >
        </div>
        <el-form
          :model="film"
          label-width="80px"
        >
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="编号">
                <el-input v-model="film.code" :disabled="!editMode" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="名称">
                <el-input v-model="film.name" :disabled="!editMode" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="年份">
                <el-input v-model.number="film.year" :disabled="!editMode" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="评分">
                <el-input v-model.number="film.rating" :disabled="!editMode" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="演员">
                <el-input v-model="film.actors" :disabled="!editMode" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="系列">
                <el-input
                  v-model="film.series"
                  :disabled="!editMode"
                  readonly
                  @click="openSeriesDialog"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="标签">
                <el-input
                  v-model="film.tags"
                  :disabled="!editMode"
                  readonly
                  placeholder="点击选择标签"
                  @click="editMode && openTagDialog()"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="文件路径">
                <el-input v-model="film.file_path" :disabled="!editMode" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="海报路径">
                <el-input v-model="film.poster_path" :disabled="!editMode" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="简介">
                <el-input
                  type="textarea"
                  :rows="4"
                  v-model="film.description"
                  :disabled="!editMode"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button type="danger" @click="remove">删除</el-button>
            <el-button @click="close">关闭</el-button>
            <el-button v-if="!editMode" type="primary" @click="enableEdit">编辑</el-button>
            <el-button v-else type="primary" @click="save">保存</el-button>
          </span>
        </template>
      </el-dialog>

      <el-dialog
        v-model="seriesDialogVisible"
        title="选择系列"
        width="400px"
      >
        <el-input
          v-model="seriesSearch"
          placeholder="输入系列名称，留空查看全部"
          clearable
        />
        <el-scrollbar style="max-height: 260px; margin-top: 12px;">
          <el-skeleton v-if="seriesLoading" rows="3" animated />
          <el-empty
            v-else-if="filteredSeries.length === 0"
            description="暂无系列"
          />
          <div
            v-else
            v-for="name in filteredSeries"
            :key="name"
            @click="pickSeries(name)"
            style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
          >
            {{ name }}
          </div>
        </el-scrollbar>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="seriesDialogVisible = false">取消</el-button>
            <el-button @click="clearSeries">清空系列</el-button>
            <el-button type="primary" @click="confirmSeries">使用当前输入</el-button>
          </span>
        </template>
      </el-dialog>

      <el-dialog
        v-model="tagDialogVisible"
        title="选择标签"
        width="400px"
      >
        <el-input
          v-model="tagSearch"
          placeholder="输入标签，回车创建并选择"
          @keyup.enter="addTagFromInput"
          clearable
        />
        <el-scrollbar height="260px" style="margin-top: 12px;">
          <el-empty
            v-if="tagAllTags.length === 0"
            description="暂无标签"
          />
          <el-checkbox-group
            v-else
            v-model="tagSelected"
          >
            <div
              v-for="name in filteredTags"
              :key="name"
              style="display: flex; align-items: center; padding: 4px 0;"
            >
              <el-checkbox :label="name">{{ name }}</el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="tagDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmTags">确定</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  `
}

window.FilmPage = {
  name: "FilmPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    // 影片列表与加载状态
    const films = Vue.ref([])
    const loading = Vue.ref(false)
    // 分页相关状态
    const currentPage = Vue.ref(1)
    const pageSize = Vue.ref(12)
    // 查询与筛选条件
    const searchName = Vue.ref("")
    const searchCode = Vue.ref("")
    const searchActor = Vue.ref("")
    const filterTag = Vue.ref("")
    const sortBy = Vue.ref("recent")

    const detailVisible = Vue.ref(false)
    const editMode = Vue.ref(false)
    // 当前选中的影片信息（用于右侧详情弹窗）
    const currentFilm = Vue.reactive({
      id: null,
      code: "",
      name: "",
      year: null,
      tags: "",
      series: "",
      actors: "",
      description: "",
      poster_path: "",
      file_path: "",
      rating: null
    })

    const createVisible = Vue.ref(false)
    // 创建影片表单数据
    const createForm = Vue.reactive({
      code: "",
      name: "",
      year: null,
      tags: "",
      series: "",
      actors: "",
      description: "",
      poster_path: "",
      file_path: "",
      rating: null
    })

    const createSeriesDialogVisible = Vue.ref(false)
    const createSeriesSearch = Vue.ref("")
    const createSeriesOptions = Vue.ref([])
    const createSeriesLoading = Vue.ref(false)

    // 创建对话框中，系列列表的过滤结果
    const createFilteredSeries = Vue.computed(() => {
      const keyword = createSeriesSearch.value.trim().toLowerCase()
      if (!keyword) {
        return createSeriesOptions.value
      }
      return createSeriesOptions.value.filter(name =>
        name.toLowerCase().includes(keyword)
      )
    })

    // 根据所有影片的 tags 字段，汇总生成全局标签选项
    const tagOptions = Vue.computed(() => {
      const set = new Set()
      films.value.forEach(f => {
        if (f.tags) {
          f.tags.split(/[;,]/).forEach(t => {
            const trimmed = t.trim()
            if (trimmed) {
              set.add(trimmed)
            }
          })
        }
      })
      return Array.from(set)
    })

    // 根据当前页和每页数量，对 films 做简单前端分页
    const pagedFilms = Vue.computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return films.value.slice(start, end)
    })

    // 创建影片时使用的标签选择弹窗相关状态
    const createTagDialogVisible = Vue.ref(false)
    const createTagSearch = Vue.ref("")
    const createTagAllTags = Vue.ref([])
    const createSelectedTags = Vue.ref([])

    // 创建对话框中，标签列表的过滤结果
    const createFilteredTags = Vue.computed(() => {
      const keyword = createTagSearch.value.trim().toLowerCase()
      const source = createTagAllTags.value
      if (!keyword) {
        return source
      }
      return source.filter(name =>
        name.toLowerCase().includes(keyword)
      )
    })

    // 打开“创建影片”中的标签选择弹窗
    const openCreateTagDialog = () => {
      const current = parseTagsText(createForm.tags)
      createSelectedTags.value = current
      const base = tagOptions.value || []
      const merged = new Set()
      const list = []
      base.forEach(name => {
        const trimmed = name && name.trim()
        if (trimmed && !merged.has(trimmed)) {
          merged.add(trimmed)
          list.push(trimmed)
        }
      })
      current.forEach(name => {
        const trimmed = name && name.trim()
        if (trimmed && !merged.has(trimmed)) {
          merged.add(trimmed)
          list.push(trimmed)
        }
      })
      createTagAllTags.value = list
      createTagSearch.value = ""
      createTagDialogVisible.value = true
    }

    // 在“创建影片”的标签弹窗中，新建一个标签并选中
    const addCreateTagFromInput = () => {
      const value = createTagSearch.value.trim()
      if (!value) {
        return
      }
      if (!createTagAllTags.value.includes(value)) {
        createTagAllTags.value.push(value)
      }
      if (!createSelectedTags.value.includes(value)) {
        createSelectedTags.value.push(value)
      }
      createTagSearch.value = ""
    }

    // 确认“创建影片”中的标签选择
    const confirmCreateTags = () => {
      const names = createSelectedTags.value
      createForm.tags = names.join("; ")
      createTagDialogVisible.value = false
    }

    // 根据当前筛选条件从后端加载影片列表
    const loadFilms = async () => {
      loading.value = true
      try {
        const params = new URLSearchParams()
        if (searchName.value) {
          params.append("q", searchName.value)
        }
        if (searchCode.value) {
          params.append("code", searchCode.value)
        }
        if (searchActor.value) {
          params.append("actor", searchActor.value)
        }
        if (filterTag.value) {
          params.append("tag", filterTag.value)
        }
        if (sortBy.value) {
          params.append("sort_by", sortBy.value)
        }
        const res = await fetch("/api/films?" + params.toString())
        if (!res.ok) {
          throw new Error("加载失败")
        }
        films.value = await res.json()
        currentPage.value = 1
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载影视列表失败")
      } finally {
        loading.value = false
      }
    }

    // 在编辑 / 删除影片后刷新列表，但保留当前页码
    const reloadFilmsKeepPage = async () => {
      const page = currentPage.value
      await loadFilms()
      currentPage.value = page
    }

    // 打开某个影片的详情弹窗
    const openDetail = film => {
      Object.assign(currentFilm, film)
      editMode.value = false
      detailVisible.value = true
    }

    const enableEdit = () => {
      editMode.value = true
    }

    // 在主页详情弹窗中保存当前影片，并刷新列表
    const saveCurrentFilm = async () => {
      if (!currentFilm.id) {
        return
      }
      try {
        const res = await fetch("/api/films/" + currentFilm.id, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(currentFilm)
        })
        if (!res.ok) {
          throw new Error("保存失败")
        }
        ElementPlus.ElMessage.success("已保存")
        detailVisible.value = false
        await loadFilms()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("保存失败")
      }
    }

    // 在主页详情弹窗中删除当前影片，并刷新列表
    const deleteCurrentFilm = async () => {
      if (!currentFilm.id) {
        return
      }
      try {
        await ElementPlus.ElMessageBox.confirm("确定要删除该影视条目吗？", "提示", {
          type: "warning"
        })
      } catch {
        return
      }
      try {
        const res = await fetch("/api/films/" + currentFilm.id, {
          method: "DELETE"
        })
        if (!res.ok) {
          throw new Error("删除失败")
        }
        ElementPlus.ElMessage.success("已删除")
        detailVisible.value = false
        await loadFilms()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("删除失败")
      }
    }

    // 打开“添加影视”对话框并重置表单
    const openCreate = () => {
      Object.keys(createForm).forEach(k => {
        createForm[k] = k === "year" || k === "rating" ? null : ""
      })
      createVisible.value = true
    }

    // 懒加载“创建影片”对话框中的系列选项
    const loadCreateSeriesOptions = async () => {
      if (createSeriesOptions.value.length > 0) {
        return
      }
      createSeriesLoading.value = true
      try {
        const res = await fetch("/api/series")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        const data = await res.json()
        createSeriesOptions.value = data.map(s => s.name)
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载系列列表失败")
      } finally {
        createSeriesLoading.value = false
      }
    }

    // 打开“创建影片”的系列选择弹窗
    const openCreateSeriesDialog = async () => {
      createSeriesSearch.value = createForm.series || ""
      await loadCreateSeriesOptions()
      createSeriesDialogVisible.value = true
    }

    // 在“创建影片”中选择某个系列
    const pickCreateSeries = name => {
      createForm.series = name
      createSeriesDialogVisible.value = false
    }

    // 使用当前输入的系列名称（可创建新系列）
    const confirmCreateSeries = () => {
      const value = createSeriesSearch.value.trim()
      const finalValue = value || ""
      createForm.series = finalValue
      if (value && !createSeriesOptions.value.includes(value)) {
        createSeriesOptions.value.push(value)
      }
      createSeriesDialogVisible.value = false
    }

    // 提交“创建影片”表单到后端
    const createFilm = async () => {
      if (!createForm.name) {
        ElementPlus.ElMessage.warning("名称不能为空")
        return
      }
      try {
        const res = await fetch("/api/films", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(createForm)
        })
        if (!res.ok) {
          throw new Error("创建失败")
        }
        ElementPlus.ElMessage.success("已创建")
        createVisible.value = false
        await loadFilms()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("创建失败")
      }
    }

    // 预留的标签格式化函数，目前直接返回原始字符串
    const formatTags = film => {
      if (!film.tags) {
        return ""
      }
      return film.tags
    }

    // 页面挂载后立即加载影片列表
    Vue.onMounted(() => {
      loadFilms()
    })

    return {
      films,
      loading,
      currentPage,
      pageSize,
      searchName,
      searchCode,
      searchActor,
      filterTag,
      sortBy,
      detailVisible,
      editMode,
      currentFilm,
      createVisible,
      createForm,
      createSeriesDialogVisible,
      createSeriesSearch,
      createSeriesOptions,
      createSeriesLoading,
      createFilteredSeries,
      createTagDialogVisible,
      createTagSearch,
      createTagAllTags,
      createSelectedTags,
      createFilteredTags,
      tagOptions,
      pagedFilms,
      loadFilms,
      reloadFilmsKeepPage,
      openDetail,
      enableEdit,
      saveCurrentFilm,
      deleteCurrentFilm,
      openCreate,
      openCreateTagDialog,
      openCreateSeriesDialog,
      pickCreateSeries,
      confirmCreateSeries,
      addCreateTagFromInput,
      confirmCreateTags,
      createFilm,
      formatTags
    }
  },
  template: `
    <div>
      <div
        class="toolbar"
        style="margin-bottom: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;"
      >
        <el-input
          v-model="searchName"
          placeholder="按名称搜索"
          clearable
          @change="loadFilms"
          style="width: 180px"
        />
        <el-input
          v-model="searchCode"
          placeholder="按编号搜索"
          clearable
          @change="loadFilms"
          style="width: 160px"
        />
        <el-input
          v-model="searchActor"
          placeholder="按演员搜索"
          clearable
          @change="loadFilms"
          style="width: 180px"
        />
        <el-select
          v-model="filterTag"
          placeholder="标签筛选"
          clearable
          @change="loadFilms"
          style="width: 160px"
        >
          <el-option
            v-for="tag in tagOptions"
            :key="tag"
            :label="tag"
            :value="tag"
          />
        </el-select>
        <el-select
          v-model="sortBy"
          placeholder="排序"
          @change="loadFilms"
          style="width: 140px"
        >
          <el-option label="最近添加" value="recent" />
          <el-option label="年份" value="year" />
        </el-select>
        <el-button type="primary" @click="openCreate">添加影视</el-button>
      </div>

      <div
        v-if="films.length > pageSize"
        style="margin-bottom: 12px; display: flex; justify-content: center;"
      >
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next, jumper"
          :total="films.length"
        />
      </div>

      <el-row :gutter="16">
        <el-col
          v-for="film in pagedFilms"
          :key="film.id"
          :xs="12"
          :sm="8"
          :md="6"
          :lg="4"
          style="margin-bottom: 16px"
        >
          <el-card shadow="hover" @click="openDetail(film)" style="cursor: pointer">
            <img
              v-if="film.poster_path"
              :src="film.poster_path"
              class="poster"
              alt=""
            >
            <div v-else class="poster"></div>
            <div class="film-title">
              {{ film.code ? film.code + " " + film.name : film.name }}
            </div>
            <div class="film-meta">
              <span v-if="film.year">{{ film.year }}</span>
              <span v-if="film.rating"> · 评分 {{ film.rating }}</span>
            </div>
            <div class="film-meta" v-if="film.tags">
              {{ film.tags }}
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="!loading && films.length === 0" description="暂无数据" />

      <FilmDetailDialog
        v-model="detailVisible"
        :film="currentFilm"
        :tag-options="tagOptions"
        @saved="reloadFilmsKeepPage"
        @deleted="reloadFilmsKeepPage"
      />

      <el-dialog
        v-model="createVisible"
        title="添加影视"
        width="640px"
      >
        <el-form
          :model="createForm"
          label-width="80px"
        >
          <el-form-item label="编号">
            <el-input v-model="createForm.code" />
          </el-form-item>
          <el-form-item label="名称" required>
            <el-input v-model="createForm.name" />
          </el-form-item>
          <el-form-item label="年份">
            <el-input v-model.number="createForm.year" />
          </el-form-item>
          <el-form-item label="演员">
            <el-input v-model="createForm.actors" />
          </el-form-item>
          <el-form-item label="标签">
            <el-input
              v-model="createForm.tags"
              readonly
              placeholder="点击选择标签"
              @click="openCreateTagDialog"
            />
          </el-form-item>
          <el-form-item label="系列">
            <el-input
              v-model="createForm.series"
              readonly
              @click="openCreateSeriesDialog"
            />
          </el-form-item>
          <el-form-item label="评分">
            <el-input v-model.number="createForm.rating" />
          </el-form-item>
          <el-form-item label="文件路径">
            <el-input v-model="createForm.file_path" />
          </el-form-item>
          <el-form-item label="海报路径">
            <el-input v-model="createForm.poster_path" />
          </el-form-item>
          <el-form-item label="简介">
            <el-input
              type="textarea"
              :rows="4"
              v-model="createForm.description"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="createVisible = false">取消</el-button>
            <el-button type="primary" @click="createFilm">创建</el-button>
          </span>
        </template>
      </el-dialog>

      <el-dialog
        v-model="createTagDialogVisible"
        title="选择标签"
        width="400px"
      >
        <el-input
          v-model="createTagSearch"
          placeholder="输入标签，回车创建并选择"
          @keyup.enter="addCreateTagFromInput"
          clearable
        />
        <el-scrollbar height="260px" style="margin-top: 12px;">
          <el-empty
            v-if="createTagAllTags.length === 0"
            description="暂无标签"
          />
          <el-checkbox-group
            v-else
            v-model="createSelectedTags"
          >
            <div
              v-for="name in createFilteredTags"
              :key="name"
              style="display: flex; align-items: center; padding: 4px 0;"
            >
              <el-checkbox :label="name">{{ name }}</el-checkbox>
            </div>
          </el-checkbox-group>
        </el-scrollbar>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="createTagDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmCreateTags">确定</el-button>
          </span>
        </template>
      </el-dialog>

      <el-dialog
        v-model="createSeriesDialogVisible"
        title="选择系列"
        width="400px"
      >
        <el-input
          v-model="createSeriesSearch"
          placeholder="输入系列名称，留空查看全部"
          clearable
        />
        <el-scrollbar height="260px" style="margin-top: 12px;">
          <el-skeleton v-if="createSeriesLoading" rows="3" animated />
          <el-empty
            v-else-if="createFilteredSeries.length === 0"
            description="暂无系列"
          />
          <div
            v-else
            v-for="name in createFilteredSeries"
            :key="name"
            @click="pickCreateSeries(name)"
            style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
          >
            {{ name }}
          </div>
        </el-scrollbar>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="createSeriesDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="confirmCreateSeries">使用当前输入</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  `
}
