const { createApp, ref } = Vue

const App = {
  name: "RootApp",
  components: {
    FilmPage: window.FilmPage,
    ActorPage: window.ActorPage
  },
  setup() {
    const currentPage = ref("films")

    const handleSelect = key => {
      currentPage.value = key
    }

    return {
      currentPage,
      handleSelect
    }
  },
  template: `
    <div>
      <div style="position: fixed; top: 0; left: 0; right: 0; z-index: 1000;">
        <el-menu
          mode="horizontal"
          :default-active="currentPage"
          @select="handleSelect"
        >
          <el-menu-item index="films">影片</el-menu-item>
          <el-menu-item index="actors">演员</el-menu-item>
        </el-menu>
      </div>
      <div style="padding-top: 56px;">
        <FilmPage v-if="currentPage === 'films'" />
        <ActorPage v-else-if="currentPage === 'actors'" />
      </div>
    </div>
  `
}

createApp(App).use(ElementPlus).mount("#app")
