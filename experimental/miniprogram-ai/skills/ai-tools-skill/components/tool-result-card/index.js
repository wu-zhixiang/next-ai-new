Component({
  properties: {
    data: {
      type: Object,
      value: {},
    },
  },
  methods: {
    copyResult() {
      const text = this.data.data.outputText || this.data.data.summary || ''
      if (!text) return
      wx.setClipboardData({ data: text })
    },
  },
})
