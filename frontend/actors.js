window.ActorPage = {
  name: "ActorPage",
  components: {
    FilmDetailDialog: window.FilmDetailDialog
  },
  setup() {
    // 演员列表与加载状态
    const actors = Vue.ref([])
    const loading = Vue.ref(false)
    const searchName = Vue.ref("")

    // 当前视图：list（列表）或 detail（详情）
    const view = Vue.ref("list")
    // 当前选中的演员及其相关影片
    const selectedActor = Vue.ref(null)
    const actorFilms = Vue.ref([])
    const filmsLoading = Vue.ref(false)

    // 演员编辑表单与编辑状态
    const actorEditMode = Vue.ref(false)
    const actorForm = Vue.reactive({
      other_names: "",
      avatar_path: "",
      level: null
    })

    // 等级数值到展示名称的映射
    const levelNames = {
      1: "夯",
      2: "顶级",
      3: "人上人",
      4: "NPC",
      5: "拉完了"
    }

    // 按等级将演员分桶，level 为 null 或异常值归到 unset
    const levelBuckets = Vue.computed(() => {
      const buckets = {
        unset: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: []
      }
      actors.value.forEach(actor => {
        const level = actor.level
        if (!level || level < 1 || level > 5) {
          buckets.unset.push(actor)
        } else {
          buckets[level].push(actor)
        }
      })
      return buckets
    })

    // 影片标签选项，用于复用 FilmDetailDialog 的标签弹窗
    const tagOptions = Vue.ref([])

    // 从后端加载标签列表
    const loadTagOptions = async () => {
      try {
        const res = await fetch("/api/tags")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        const data = await res.json()
        tagOptions.value = data.map(t => t.name)
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载标签列表失败")
      }
    }

    // 演员详情页中的影片详情弹窗状态
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

    // 从后端加载演员列表，可按名称模糊搜索
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

    // 加载某个演员参与的影片列表
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

    // 打开演员详情视图并加载其相关影片
    const openActorDetail = async actor => {
      selectedActor.value = actor
      actorEditMode.value = false
      actorForm.other_names = actor.other_names || ""
      actorForm.avatar_path = actor.avatar_path || ""
      actorForm.level = actor.level || null
      view.value = "detail"
      await loadActorFilms(actor)
    }

    // 返回演员列表视图并重置详情状态
    const backToList = () => {
      view.value = "list"
      selectedActor.value = null
      actorFilms.value = []
      actorEditMode.value = false
      actorForm.other_names = ""
      actorForm.avatar_path = ""
      actorForm.level = null
    }

    // 进入演员信息编辑模式
    const enableActorEdit = () => {
      if (!selectedActor.value) {
        return
      }
      actorEditMode.value = true
      actorForm.other_names = selectedActor.value.other_names || ""
      actorForm.avatar_path = selectedActor.value.avatar_path || ""
      actorForm.level = selectedActor.value.level || null
    }

    // 取消编辑，恢复为当前选中演员的信息
    const cancelActorEdit = () => {
      actorEditMode.value = false
      if (selectedActor.value) {
        actorForm.other_names = selectedActor.value.other_names || ""
        actorForm.avatar_path = selectedActor.value.avatar_path || ""
        actorForm.level = selectedActor.value.level || null
      } else {
        actorForm.other_names = ""
        actorForm.avatar_path = ""
        actorForm.level = null
      }
    }

    // 保存演员信息（别名 / 头像 / 等级）
    const saveActor = async () => {
      if (!selectedActor.value) {
        return
      }
      try {
        const res = await fetch("/api/actors/" + selectedActor.value.id, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            other_names: actorForm.other_names || null,
            avatar_path: actorForm.avatar_path || null,
            level: actorForm.level || null
          })
        })
        if (!res.ok) {
          throw new Error("保存失败")
        }
        const updated = await res.json()
        selectedActor.value = updated
        const index = actors.value.findIndex(a => a.id === updated.id)
        if (index !== -1) {
          actors.value[index] = updated
        }
        actorEditMode.value = false
        ElementPlus.ElMessage.success("演员信息已保存")
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("保存演员信息失败")
      }
    }

    // 删除当前选中的演员（不会删除任何影片）
    const deleteActor = async () => {
      if (!selectedActor.value) {
        return
      }
      try {
        await ElementPlus.ElMessageBox.confirm(
          "确定要删除该演员吗？此操作不会删除任何影片，仅删除演员本身。",
          "提示",
          {
            type: "warning"
          }
        )
      } catch {
        return
      }
      try {
        const res = await fetch("/api/actors/" + selectedActor.value.id, {
          method: "DELETE"
        })
        if (!res.ok) {
          throw new Error("删除失败")
        }
        ElementPlus.ElMessage.success("演员已删除")
        actors.value = actors.value.filter(a => a.id !== selectedActor.value.id)
        backToList()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("删除演员失败")
      }
    }

    // 打开演员详情页中某个影片的详情弹窗
    const openFilmDetail = film => {
      Object.assign(currentFilm, film)
      filmDetailVisible.value = true
    }

    // 影片保存后，刷新当前演员的影片列表
    const handleFilmSaved = async () => {
      if (selectedActor.value) {
        await loadActorFilms(selectedActor.value)
      }
    }

    // 影片删除后，刷新当前演员的影片列表
    const handleFilmDeleted = async () => {
      if (selectedActor.value) {
        await loadActorFilms(selectedActor.value)
      }
    }

    // 页面挂载后加载演员列表和全局标签列表
    Vue.onMounted(() => {
      loadActors()
      loadTagOptions()
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
      actorEditMode,
      actorForm,
      enableActorEdit,
      cancelActorEdit,
      saveActor,
      deleteActor,
      filmDetailVisible,
      currentFilm,
      openFilmDetail,
      handleFilmSaved,
      handleFilmDeleted,
      levelNames,
      levelBuckets,
      tagOptions
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

        <div v-for="level in [1, 2, 3, 4, 5]" :key="level" style="margin-bottom: 24px;">
          <div class="film-title">{{ levelNames[level] }}</div>
          <el-row :gutter="16" style="margin-top: 8px;">
            <el-col
              v-for="actor in levelBuckets[level]"
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
                <div
                  class="film-meta"
                  v-if="actor.level"
                >
                  等级：{{ levelNames[actor.level] || actor.level }}
                </div>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <div v-if="levelBuckets.unset.length" style="margin-bottom: 24px;">
          <div class="film-title">未设置</div>
          <el-row :gutter="16" style="margin-top: 8px;">
            <el-col
              v-for="actor in levelBuckets.unset"
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
        </div>

        <el-empty v-if="!loading && actors.length === 0" description="暂无演员" />
      </div>

      <div v-else-if="view === 'detail'">
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 16px;">
          <el-button @click="backToList">返回演员列表</el-button>
          <div v-if="selectedActor">
            <div class="film-title">{{ selectedActor.name }}</div>
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
              <div class="film-meta" v-if="!actorEditMode && selectedActor.other_names">
                {{ selectedActor.other_names }}
              </div>
              <div class="film-meta" v-if="!actorEditMode && selectedActor.level">
                等级：{{ levelNames[selectedActor.level] || selectedActor.level }}
              </div>
              <div v-if="actorEditMode" style="margin-top: 12px;">
                <el-form
                  :model="actorForm"
                  label-width="80px"
                >
                  <el-form-item label="其他名称">
                    <el-input v-model="actorForm.other_names" />
                  </el-form-item>
                  <el-form-item label="头像 URL">
                    <el-input v-model="actorForm.avatar_path" />
                  </el-form-item>
                  <el-form-item label="等级">
                    <el-select v-model="actorForm.level" placeholder="选择等级">
                      <el-option
                        v-for="level in [1, 2, 3, 4, 5]"
                        :key="level"
                        :label="levelNames[level]"
                        :value="level"
                      />
                    </el-select>
                  </el-form-item>
                </el-form>
              </div>
              <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                <el-button type="primary" size="small" v-if="!actorEditMode" @click.stop="enableActorEdit">编辑演员</el-button>
                <el-button size="small" v-else @click.stop="cancelActorEdit">取消编辑</el-button>
                <el-button
                  type="primary"
                  size="small"
                  v-if="actorEditMode"
                  @click.stop="saveActor"
                >
                  保存演员
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  @click.stop="deleteActor"
                >
                  删除演员
                </el-button>
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
          v-if="!filmsLoading && actorFilms.length === 0"
          description="暂无相关影片"
        />

        <FilmDetailDialog
          v-model="filmDetailVisible"
          :film="currentFilm"
          :tag-options="tagOptions"
          @saved="handleFilmSaved"
          @deleted="handleFilmDeleted"
        />
      </div>
    </div>
  `
}
