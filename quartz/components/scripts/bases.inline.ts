// Client-side script for Obsidian Bases functionality

document.addEventListener("nav", () => {
  // Handle view tabs
  const tabs = document.querySelectorAll(".base-view-tab")
  tabs.forEach((tab) => {
    tab.addEventListener("click", function (this: HTMLElement) {
      const viewIndex = this.getAttribute("data-view-index")
      const container = this.closest(".base-inline")

      if (!container || !viewIndex) return

      // Update active tab
      container.querySelectorAll(".base-view-tab").forEach((t) => t.classList.remove("active"))
      this.classList.add("active")

      // Show corresponding view
      container.querySelectorAll(".base-view").forEach((v: Element) => {
        const view = v as HTMLElement
        if (view.getAttribute("data-view-index") === viewIndex) {
          view.style.display = "block"
        } else {
          view.style.display = "none"
        }
      })
    })
  })

  // Handle base embeds and inline bases
  // This would need access to the full content graph to resolve references
  // For now, we'll add a data attribute that can be processed server-side
})
