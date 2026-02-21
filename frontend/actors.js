window.ActorPage = {
  name: "ActorPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    const actors = Vue.ref([])
    const loading = Vue.ref(false)
    const searchName = Vue.ref("")

    const view = Vue.ref("list")
    const selectedActor = Vue.ref(null)
    const actorFilms = Vue.ref([])
    const filmsLoading = Vue.ref(false)

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

    const loadActors = async () => {
      loading.value = true
      try {
        const params = new URLSearchParams()
        if (searchName.value) {
          params.append("q", searchName.value)
        }
        const res = await fetch("/api/actors?" + params.toString())
        if (!res.ok) {
          throw new Error("加载失败")
        }
        actors.value = await res.json()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载演员列表失败")
      } finally {
        loading.value = false
      }
    }

    const loadActorFilms = async actor => {
      filmsLoading.value = true
      try {
        const params = new URLSearchParams()
        if (actor && actor.name) {
          params.append("actor", actor.name)
        }
        const res = await fetch("/api/films?" + params.toString())
        if (!res.ok) {
          throw new Error("加载失败")
        }
        actorFilms.value = await res.json()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载影片列表失败")
      } finally {
        filmsLoading.value = false
      }
    }

    const openActorDetail = async actor => {
      selectedActor.value = actor
      view.value = "detail"
      await loadActorFilms(actor)
    }

    const backToList = () => {
      view.value = "list"
      selectedActor.value = null
      actorFilms.value = []
    }

    const openFilmDetail = film => {
      Object.assign(currentFilm, film)
      filmDetailVisible.value = true
    }

    const handleFilmSaved = async () => {
      if (selectedActor.value) {
        await loadActorFilms(selectedActor.value)
      }
    }

    const handleFilmDeleted = async () => {
      if (selectedActor.value) {
        await loadActorFilms(selectedActor.value)
      }
    }

    Vue.onMounted(() => {
      loadActors()
    })

    return {
      actors,
      loading,
      searchName,
      loadActors,
      view,
      selectedActor,
      actorFilms,
      filmsLoading,
      openActorDetail,
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
        <div style="margin-bottom: 16px; max-width: 320px;">
          <el-input
            v-model="searchName"
            placeholder="按演员名称搜索"
            clearable
            @change="loadActors"
          />
        </div>

        <el-row :gutter="16">
          <el-col
            v-for="actor in actors"
            :key="actor.id"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
            style="margin-bottom: 16px"
          >
            <el-card shadow="hover" @click="openActorDetail(actor)" style="cursor: pointer">
              <img
                v-if="actor.avatar_path"
                :src="actor.avatar_path"
                class="poster"
                alt=""
              >
              <div v-else class="poster"></div>
              <div class="film-title">{{ actor.name }}</div>
              <div
                class="film-meta"
                v-if="actor.other_names"
              >
                {{ actor.other_names }}
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-empty v-if="!loading && actors.length === 0" description="暂无演员" />
      </div>

      <div v-else-if="view === 'detail'">
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
          <el-button @click="backToList">返回演员列表</el-button>
          <div v-if="selectedActor">
            <div class="film-title">{{ selectedActor.name }}</div>
            <div class="film-meta" v-if="selectedActor.other_names">
              {{ selectedActor.other_names }}
            </div>
          </div>
        </div>

        <el-row :gutter="16" style="margin-bottom: 16px;">
          <el-col :xs="12" :sm="8" :md="6" :lg="4" v-if="selectedActor">
            <el-card>
              <img
                v-if="selectedActor.avatar_path"
                :src="selectedActor.avatar_path"
                class="poster"
                alt=""
              >
              <div v-else class="poster"></div>
              <div class="film-title">{{ selectedActor.name }}</div>
              <div class="film-meta" v-if="selectedActor.other_names">
                {{ selectedActor.other_names }}
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div style="margin-bottom: 8px;">相关影片</div>

        <el-row :gutter="16">
          <el-col
            v-for="film in actorFilms"
            :key="film.id"
            :xs="12"
            :sm="8"
            :md="6"
            :lg="4"
            style="margin-bottom: 16px"
          >
            <el-card shadow="hover" style="cursor: pointer" @click="openFilmDetail(film)">
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
          v-if="!filmsLoading && actorFilms.length === 0"
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
