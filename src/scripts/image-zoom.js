function isDesktop() {
  return window.matchMedia("(pointer: fine)").matches;
}

function zoomImage(overlay, img) {
  overlay.querySelector("img").src = img.currentSrc || img.src;
  overlay.classList.add("active");
}

function unzoomImage(overlay) {
  overlay.classList.remove("active");
}

document.addEventListener("click", (e) => {
  if (!isDesktop()) return;

  const overlay = document.querySelector(".zoom-overlay");
  
  const clickableSvg = e.target.closest(".clickable-svg");
  if (clickableSvg) {
    window.open(clickableSvg.src, '_blank');
    return;
  }

  const img = e.target.closest(".zoomable-img");
  if (img) {
    zoomImage(overlay, img);
    return;
  }

  if (overlay && overlay.classList.contains("active")) {
    unzoomImage(overlay);
  }
});