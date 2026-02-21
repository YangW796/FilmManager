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
    }
  },
  emits: ["update:modelValue", "saved", "deleted"],
  setup(props, { emit }) {
    const editMode = Vue.ref(false)

    const close = () => {
      emit("update:modelValue", false)
      editMode.value = false
    }

    const enableEdit = () => {
      editMode.value = true
    }

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
      close,
      enableEdit,
      save,
      remove
    }
  },
  template: `
    <el-dialog
      :model-value="modelValue"
      title="详情"
      width="640px"
      @close="close"
    >
      <el-form
        :model="film"
        label-width="80px"
      >
        <el-form-item label="名称">
          <el-input v-model="film.name" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="年份">
          <el-input v-model.number="film.year" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="演员">
          <el-input v-model="film.actors" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="film.tags" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="系列">
          <el-input v-model="film.series" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="评分">
          <el-input v-model.number="film.rating" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="文件路径">
          <el-input v-model="film.file_path" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="海报路径">
          <el-input v-model="film.poster_path" :disabled="!editMode" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            type="textarea"
            :rows="4"
            v-model="film.description"
            :disabled="!editMode"
          />
        </el-form-item>
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
  `
}

window.FilmPage = {
  name: "FilmPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    const films = Vue.ref([])
    const loading = Vue.ref(false)
    const searchName = Vue.ref("")
    const searchActor = Vue.ref("")
    const filterTag = Vue.ref("")
    const sortBy = Vue.ref("recent")

    const detailVisible = Vue.ref(false)
    const editMode = Vue.ref(false)
    const currentFilm = Vue.reactive({
      id: null,
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
    const createForm = Vue.reactive({
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

    const loadFilms = async () => {
      loading.value = true
      try {
        const params = new URLSearchParams()
        if (searchName.value) {
          params.append("q", searchName.value)
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
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载影视列表失败")
      } finally {
        loading.value = false
      }
    }

    const openDetail = film => {
      Object.assign(currentFilm, film)
      editMode.value = false
      detailVisible.value = true
    }

    const enableEdit = () => {
      editMode.value = true
    }

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

    const openCreate = () => {
      Object.keys(createForm).forEach(k => {
        createForm[k] = k === "year" || k === "rating" ? null : ""
      })
      createVisible.value = true
    }

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

    const formatTags = film => {
      if (!film.tags) {
        return ""
      }
      return film.tags
    }

    Vue.onMounted(() => {
      loadFilms()
    })

    return {
      films,
      loading,
      searchName,
      searchActor,
      filterTag,
      sortBy,
      detailVisible,
      editMode,
      currentFilm,
      createVisible,
      createForm,
      tagOptions,
      loadFilms,
      openDetail,
      enableEdit,
      saveCurrentFilm,
      deleteCurrentFilm,
      openCreate,
      createFilm,
      formatTags
    }
  },
  template: `
    <div>
      <div class="toolbar" style="margin-bottom: 16px">
        <el-input
          v-model="searchName"
          placeholder="按名称搜索"
          clearable
          @change="loadFilms"
        />
        <el-input
          v-model="searchActor"
          placeholder="按演员搜索"
          clearable
          @change="loadFilms"
        />
        <el-select
          v-model="filterTag"
          placeholder="标签筛选"
          clearable
          @change="loadFilms"
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
        >
          <el-option label="最近添加" value="recent" />
          <el-option label="年份" value="year" />
        </el-select>
        <el-button type="primary" @click="openCreate">添加影视</el-button>
      </div>

      <el-row :gutter="16">
        <el-col
          v-for="film in films"
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
            <div class="film-title">{{ film.name }}</div>
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
        @saved="loadFilms"
        @deleted="loadFilms"
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
            <el-input v-model="createForm.tags" />
          </el-form-item>
          <el-form-item label="系列">
            <el-input v-model="createForm.series" />
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
    </div>
  `
}
