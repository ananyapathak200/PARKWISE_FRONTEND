/*
  photo-drop.js
  A friendly photo picker used on the home page, the owner dashboard and the
  edit-listing page. It upgrades this markup:

    <div class="photo-drop" data-photo-drop>
      <input type="file" id="x" class="photo-drop__input" accept="image/jpeg,image/png,image/webp" />
      <label for="x" class="photo-drop__zone"> …empty state… <img class="photo-drop__preview" hidden></label>
      <div class="photo-drop__bar" hidden> …name, Change, Remove… </div>
      <p class="photo-drop__error" role="alert"></p>
    </div>

  - drag a photo onto the box, or tap it to choose one
  - shows a preview straight away; checks type (JPEG/PNG/WEBP) and size (5 MB)
  - fires a "photo-change" event on the wrapper with { file } (null when removed)
*/
(function () {
  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = /^image\/(jpeg|png|webp)$/;

  function sizeLabel(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function parts(root) {
    return {
      input: root.querySelector(".photo-drop__input"),
      zone: root.querySelector(".photo-drop__zone"),
      img: root.querySelector(".photo-drop__preview"),
      bar: root.querySelector(".photo-drop__bar"),
      name: root.querySelector(".photo-drop__name"),
      error: root.querySelector(".photo-drop__error"),
    };
  }

  function showError(root, message) {
    const { error } = parts(root);
    if (error) error.textContent = message || "";
  }

  function render(root, file, url) {
    const p = parts(root);
    if (root._url) { URL.revokeObjectURL(root._url); root._url = null; }
    if (file) {
      root._url = URL.createObjectURL(file);
      p.img.src = root._url;
    } else if (url) {
      p.img.src = url;
    }
    const has = Boolean(file || url);
    p.img.hidden = !has;
    root.classList.toggle("has-photo", has);
    if (p.bar) p.bar.hidden = !has;
    if (p.name) p.name.textContent = file ? `${file.name}, ${sizeLabel(file.size)}` : (url ? "Current photo" : "");
  }

  function setFile(root, file) {
    showError(root, "");
    if (file && !TYPES.test(file.type)) { showError(root, "Choose a JPEG, PNG or WEBP photo."); return false; }
    if (file && file.size > MAX_BYTES) { showError(root, "That photo is larger than 5 MB. Choose a smaller one."); return false; }
    const { input } = parts(root);
    root._file = file || null;
    // keep the real <input> in sync so normal form code can read input.files
    try {
      const dt = new DataTransfer();
      if (file) dt.items.add(file);
      input.files = dt.files;
    } catch (e) { /* very old browsers: getFile() below still works */ }
    if (!file) input.value = "";
    render(root, file, file ? null : root._existingUrl);
    root.dispatchEvent(new CustomEvent("photo-change", { detail: { file: root._file } }));
    return true;
  }

  function init(root) {
    if (!root || root._ready) return;
    root._ready = true;
    const p = parts(root);

    p.input.addEventListener("change", () => {
      const file = p.input.files[0] || null;
      if (!setFile(root, file)) p.input.value = "";   // keep the error message visible
    });

    ["dragenter", "dragover"].forEach((type) => p.zone.addEventListener(type, (e) => {
      e.preventDefault();
      root.classList.add("is-dragging");
    }));
    ["dragleave", "dragend", "drop"].forEach((type) => p.zone.addEventListener(type, () => root.classList.remove("is-dragging")));
    p.zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) setFile(root, file);
    });

    const remove = root.querySelector(".photo-drop__remove");
    if (remove) remove.addEventListener("click", () => { root._existingUrl = null; setFile(root, null); });
  }

  /* Shrinks a photo to at most 1600 px on its longest side and returns a JPEG data URL
     (used to carry the home-page photo over to the dashboard). */
  function toDataUrl(file, maxSide = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo.")); };
      img.src = url;
    });
  }

  function dataUrlToFile(dataUrl, name) {
    const [head, body] = dataUrl.split(",");
    const type = (head.match(/data:(.*?);/) || [])[1] || "image/jpeg";
    const bytes = atob(body);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], name || "photo.jpg", { type });
  }

  window.PhotoDrop = {
    init,
    setFile,
    getFile: (root) => (root && root._file) || null,
    clear: (root) => { root._existingUrl = null; setFile(root, null); },
    showExisting: (root, url) => { root._existingUrl = url; render(root, null, url); },
    toDataUrl,
    dataUrlToFile,
  };

  document.querySelectorAll("[data-photo-drop]").forEach(init);
})();
