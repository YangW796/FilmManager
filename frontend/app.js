const { createApp, ref } = Vue

const App = {
  name: "RootApp",
  components: {
    // 四个主页面组件，通过顶部菜单进行切换
    FilmPage: window.FilmPage,
    ActorPage: window.ActorPage,
    SeriesPage: window.SeriesPage,
    TagPage: window.TagPage
  },
  setup() {
    // 当前激活的菜单 key，对应具体页面
    const currentPage = ref("films")

    // 顶部菜单切换时更新当前页面
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
          <el-menu-item index="series">系列</el-menu-item>
          <el-menu-item index="tags">标签</el-menu-item>
        </el-menu>
      </div>
      <div style="padding-top: 56px;">
        <FilmPage v-if="currentPage === 'films'" />
        <ActorPage v-else-if="currentPage === 'actors'" />
        <SeriesPage v-else-if="currentPage === 'series'" />
        <TagPage v-else-if="currentPage === 'tags'" />
      </div>
    </div>
  `
}

createApp(App).use(ElementPlus).mount("#app")
