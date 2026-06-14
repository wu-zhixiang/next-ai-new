Component({
  properties: {
    data: {
      type: Object,
      value: {},
    },
  },
  methods: {
    openTool(event) {
      const toolId = event.currentTarget.dataset.toolId
      if (!toolId) return
      wx.navigateTo({
        url: `/pages/tool-detail/index?tool=${encodeURIComponent(toolId)}`,
      })
    },
  },
})
