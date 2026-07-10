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
      const introToolIds = ['imageGenerate', 'imageRepair']
      const page = introToolIds.includes(toolId) ? 'tool-intro' : 'tool-detail'
      wx.navigateTo({
        url: `/pages/${page}/index?tool=${encodeURIComponent(toolId)}`,
      })
    },
  },
})
