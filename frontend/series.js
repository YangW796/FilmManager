window.SeriesPage = {
  name: "SeriesPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    const view = Vue.ref("list")
    const seriesList = Vue.ref([])
    const loading = Vue.ref(false)
    const selectedSeries = Vue.ref("")
    const seriesFilms = Vue.ref([])
    const filmsLoading = Vue.ref(false)

    const loadSeries = async () => {
      loading.value = true
      try {
        const res = await fetch("/api/films")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        const data = await res.json()
        const set = new Set()
        data.forEach(f => {
          if (f.series) {
            set.add(f.series)
          }
        })
        seriesList.value = Array.from(set)
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载系列列表失败")
      } finally {
        loading.value = false
      }
    }

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

    const openSeriesDetail = async name => {
      selectedSeries.value = name
      view.value = "detail"
      await loadSeriesFilms(name)
    }

    const backToList = () => {
      view.value = "list"
      selectedSeries.value = ""
      seriesFilms.value = []
    }

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

    const openFilmDetail = film => {
      Object.assign(currentFilm, film)
      filmDetailVisible.value = true
    }

    const handleFilmSaved = async () => {
      if (selectedSeries.value) {
        await loadSeriesFilms(selectedSeries.value)
      }
    }

    const handleFilmDeleted = async () => {
      if (selectedSeries.value) {
        await loadSeriesFilms(selectedSeries.value)
      }
    }

    Vue.onMounted(() => {
      loadSeries()
    })

    return {
      view,
      seriesList,
      loading,
      selectedSeries,
      seriesFilms,
      filmsLoading,
      openSeriesDetail,
      backToList,
      filmDetailVisible,
      currentFilm,
      openFilmDetail,
      handleFilmSaved,
      handleFilmDeleted
    }
  },
  template: `
    <div>
      <div v-if="view === 'list'">
        <el-row :gutter="16">
          <el-col
            v-for="name in seriesList"
            :key="name"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
            style="margin-bottom: 16px"
          >
            <el-card
              shadow="hover"
              style="cursor: pointer"
              @click="openSeriesDetail(name)"
            >
              <div class="film-title">{{ name }}</div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty
          v-if="!loading && seriesList.length === 0"
          description="暂无系列"
        />
      </div>

      <div v-else-if="view === 'detail'">
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
          <el-button @click="backToList">返回系列列表</el-button>
          <div v-if="selectedSeries">
            <div class="film-title">{{ selectedSeries }}</div>
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

