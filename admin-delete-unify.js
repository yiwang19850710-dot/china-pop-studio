(() => {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.get("admin") === "1" || window.location.hash === "#admin";
  if (!isAdminMode || window.CHINA_POP_ADMIN_DELETE_UNIFY) return;
  window.CHINA_POP_ADMIN_DELETE_UNIFY = true;

  function alignDeleteButtons() {
    const localButton = document.querySelector("#bulkDeleteLocal");
    if (localButton) localButton.textContent = "Delete checked globally / 删除勾选并同步用户版";
    const globalButton = document.querySelector("#bulkDeleteGlobal");
    if (globalButton) globalButton.textContent = "Delete checked globally / 全网删除勾选";
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const localButton = target.closest("#bulkDeleteLocal");
    if (!localButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const globalButton = document.querySelector("#bulkDeleteGlobal");
    if (globalButton instanceof HTMLButtonElement && !globalButton.disabled) {
      globalButton.click();
    }
  }, true);

  alignDeleteButtons();
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    alignDeleteButtons();
    if (ticks >= 20) window.clearInterval(timer);
  }, 500);
})();
