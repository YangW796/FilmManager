window.SeriesPage = {
  name: "SeriesPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    // 当前视图：系列列表 / 单个系列详情
    const view = Vue.ref("list")
    // 系列列表与加载状态
    const seriesList = Vue.ref([])
    const loading = Vue.ref(false)
    // 当前选中的系列信息及其影片列表
    const selectedSeriesId = Vue.ref(null)
    const selectedSeries = Vue.ref("")
    const seriesNameEdit = Vue.ref("")
    const seriesFilms = Vue.ref([])
    const filmsLoading = Vue.ref(false)

    // 从后端加载所有系列
    const loadSeries = async () => {
      loading.value = true
      try {
        const res = await fetch("/api/series")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        const data = await res.json()
        seriesList.value = data
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载系列列表失败")
      } finally {
        loading.value = false
      }
    }

    // 加载某个系列下的所有影片
    const loadSeriesFilms = async name => {
      filmsLoading.value = true
      try {
        const params = new URLSearchParams()
        params.append("series", name)
        const res = await fetch("/api/films?" + params.toString())
        if (!res.ok) {
          throw new Error("加载失败")
        }
        seriesFilms.value = await res.json()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载系列影片失败")
      } finally {
        filmsLoading.value = false
      }
    }

    // 打开某个系列的详情视图
    const openSeriesDetail = async series => {
      selectedSeriesId.value = series.id
      selectedSeries.value = series.name
      seriesNameEdit.value = series.name
      view.value = "detail"
      await loadSeriesFilms(series.name)
    }

    // 重命名当前系列
    const renameSeries = async () => {
      if (!selectedSeriesId.value) {
        return
      }
      const newName = (seriesNameEdit.value || "").trim()
      if (!newName) {
        ElementPlus.ElMessage.warning("系列名称不能为空")
        seriesNameEdit.value = selectedSeries.value
        return
      }
      if (newName === selectedSeries.value) {
        return
      }
      try {
        const res = await fetch("/api/series/" + selectedSeriesId.value, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id: selectedSeriesId.value,
            name: newName
          })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          const message = data && data.detail ? data.detail : "重命名失败"
          throw new Error(message)
        }
        const updated = await res.json()
        selectedSeries.value = updated.name
        seriesNameEdit.value = updated.name
        const index = seriesList.value.findIndex(item => item.id === updated.id)
        if (index !== -1) {
          seriesList.value[index] = updated
        }
        ElementPlus.ElMessage.success("系列名称已更新")
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error(e.message || "重命名失败")
        seriesNameEdit.value = selectedSeries.value
      }
    }

    // 删除当前选中的系列，仅清空影片的 series_id，不删除影片
    const deleteSeries = async () => {
      if (!selectedSeries.value) {
        return
      }
      try {
        await ElementPlus.ElMessageBox.confirm("确定要删除该系列吗？相关影片将不再属于该系列。", "提示", {
          type: "warning"
        })
      } catch {
        return
      }
      const target = seriesList.value.find(item => item.id === selectedSeriesId.value)
      if (!target) {
        ElementPlus.ElMessage.error("未找到该系列")
        return
      }
      try {
        const res = await fetch("/api/series/" + target.id, {
          method: "DELETE"
        })
        if (!res.ok) {
          throw new Error("删除失败")
        }
        ElementPlus.ElMessage.success("系列已删除")
        await loadSeries()
        backToList()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("删除系列失败")
      }
    }

    // 返回系列列表视图
    const backToList = () => {
      view.value = "list"
      selectedSeriesId.value = null
      selectedSeries.value = ""
      seriesNameEdit.value = ""
      seriesFilms.value = []
    }

    // 系列详情页中的影片详情弹窗状态
    const filmDetailVisible = Vue.ref(false)
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

    // 打开某个影片的详情弹窗
    const openFilmDetail = film => {
      Object.assign(currentFilm, film)
      filmDetailVisible.value = true
    }

    // 影片保存后，根据系列变化即时更新当前系列影片列表
    const handleFilmSaved = () => {
      if (!selectedSeries.value || !currentFilm.id) {
        return
      }
      const currentId = currentFilm.id
      const newSeriesName = currentFilm.series || ""
      if (!newSeriesName || newSeriesName !== selectedSeries.value) {
        // 系列被清空或切换到其他系列，从当前列表中移除
        seriesFilms.value = seriesFilms.value.filter(f => f.id !== currentId)
      } else {
        // 仍属于当前系列，更新该影片的展示信息
        const index = seriesFilms.value.findIndex(f => f.id === currentId)
        if (index !== -1) {
          seriesFilms.value[index] = {
            ...seriesFilms.value[index],
            ...currentFilm
          }
        }
      }
    }

    // 影片删除后刷新当前系列影片列表
    const handleFilmDeleted = async () => {
      if (selectedSeries.value) {
        await loadSeriesFilms(selectedSeries.value)
      }
    }

    // 页面挂载后加载系列列表
    Vue.onMounted(() => {
      loadSeries()
    })

    return {
      view,
      seriesList,
      loading,
      selectedSeriesId,
      selectedSeries,
      seriesNameEdit,
      seriesFilms,
      filmsLoading,
      openSeriesDetail,
      renameSeries,
      backToList,
      filmDetailVisible,
      currentFilm,
      openFilmDetail,
      handleFilmSaved,
      handleFilmDeleted,
      deleteSeries
    }
  },
  template: `
    <div>
      <div v-if="view === 'list'">
        <el-row :gutter="16">
          <el-col
            v-for="series in seriesList"
            :key="series.id"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
            style="margin-bottom: 16px"
          >
            <el-card
              shadow="hover"
              style="cursor: pointer"
              @click="openSeriesDetail(series)"
            >
              <img
                v-if="series.poster_path"
                :src="series.poster_path"
                class="poster"
                alt=""
              >
              <div v-else class="poster"></div>
              <div class="film-title">{{ series.name }}</div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty
          v-if="!loading && seriesList.length === 0"
          description="暂无系列"
        />
      </div>

      <div v-else-if="view === 'detail'">
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
          <el-button @click="backToList">返回系列列表</el-button>
          <el-button type="danger" @click="deleteSeries">删除当前系列</el-button>
          <div v-if="selectedSeries" style="display: flex; align-items: center; gap: 8px;">
            <el-input
              v-model="seriesNameEdit"
              placeholder="系列名称"
              style="width: 220px"
            />
            <el-button type="primary" @click="renameSeries">保存名称</el-button>
          </div>
        </div>

        <el-row :gutter="16">
          <el-col
            v-for="film in seriesFilms"
            :key="film.id"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
            style="margin-bottom: 16px"
          >
            <el-card
              shadow="hover"
              style="cursor: pointer"
              @click="openFilmDetail(film)"
            >
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

        <el-empty
          v-if="!filmsLoading && seriesFilms.length === 0"
          description="暂无相关影片"
        />

        <FilmDetailDialog
          v-model="filmDetailVisible"
          :film="currentFilm"
          @saved="handleFilmSaved"
          @deleted="handleFilmDeleted"
        />
      </div>
    </div>
  `
}
