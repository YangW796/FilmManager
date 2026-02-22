window.TagPage = {
  name: "TagPage",
  setup() {
    // 标签列表与加载状态
    const tags = Vue.ref([])
    const loading = Vue.ref(false)

    // 从后端加载所有标签
    const loadTags = async () => {
      loading.value = true
      try {
        const res = await fetch("/api/tags")
        if (!res.ok) {
          throw new Error("加载失败")
        }
        tags.value = await res.json()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("加载标签列表失败")
      } finally {
        loading.value = false
      }
    }

    // 重命名标签，会校验非空并处理后端重复名错误信息
    const renameTag = async tag => {
      try {
        const { value } = await ElementPlus.ElMessageBox.prompt(
          "请输入新的标签名称",
          "重命名标签",
          {
            inputValue: tag.name,
            inputValidator: val => {
              if (!val || !val.trim()) {
                return "名称不能为空"
              }
              return true
            },
            confirmButtonText: "确定",
            cancelButtonText: "取消"
          }
        )
        const newName = value.trim()
        if (!newName || newName === tag.name) {
          return
        }
        const res = await fetch("/api/tags/" + tag.id, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ id: tag.id, name: newName })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          const message = data && data.detail ? data.detail : "重命名失败"
          throw new Error(message)
        }
        ElementPlus.ElMessage.success("已重命名")
        await loadTags()
      } catch (e) {
        if (e === "cancel" || e === "close") {
          return
        }
        console.error(e)
        ElementPlus.ElMessage.error(e.message || "重命名失败")
      }
    }

    // 删除标签，后端会同时清理与影片的关联
    const deleteTag = async tag => {
      try {
        await ElementPlus.ElMessageBox.confirm(
          `确定要删除标签「${tag.name}」吗？`,
          "提示",
          {
            type: "warning",
            confirmButtonText: "删除",
            cancelButtonText: "取消"
          }
        )
      } catch {
        return
      }
      try {
        const res = await fetch("/api/tags/" + tag.id, {
          method: "DELETE"
        })
        if (!res.ok) {
          throw new Error("删除失败")
        }
        ElementPlus.ElMessage.success("已删除")
        await loadTags()
      } catch (e) {
        console.error(e)
        ElementPlus.ElMessage.error("删除失败")
      }
    }

    // 页面挂载后加载标签列表
    Vue.onMounted(() => {
      loadTags()
    })

    return {
      tags,
      loading,
      loadTags,
      renameTag,
      deleteTag
    }
  },
  template: `
    <div>
      <div class="toolbar" style="margin-bottom: 16px">
        <el-button
          type="primary"
          :loading="loading"
          @click="loadTags"
        >
          刷新
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="tags"
        border
        style="width: 100%"
      >
        <el-table-column
          type="index"
          width="60"
          label="#"
        />
        <el-table-column
          prop="name"
          label="标签名称"
        />
        <el-table-column
          label="操作"
          width="200"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              @click.stop="renameTag(row)"
            >
              重命名
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click.stop="deleteTag(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && tags.length === 0"
        description="暂无标签"
      />
    </div>
  `
}
