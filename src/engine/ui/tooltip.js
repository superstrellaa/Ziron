let tooltipEl = null;
let activeTarget = null;

export function initTooltipSystem(root = document.body) {
  tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  document.body.appendChild(tooltipEl);

  root.addEventListener("mouseover", onMouseOver);
  root.addEventListener("mouseout", onMouseOut);
  root.addEventListener("mousemove", onMouseMove);
}

function onMouseOver(e) {
  const target = e.target.closest("[data-tooltip]");
  if (!target) return;

  activeTarget = target;

  const text = target.dataset.tooltip;
  tooltipEl.textContent = text;

  tooltipEl.style.opacity = "1";
}

function onMouseOut(e) {
  if (!activeTarget) return;

  if (!e.relatedTarget || !activeTarget.contains(e.relatedTarget)) {
    tooltipEl.style.opacity = "0";
    activeTarget = null;
  }
}

function onMouseMove(e) {
  if (!activeTarget) return;

  const offset = 10;

  const tooltipRect = tooltipEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let x = e.clientX + offset;
  let y = e.clientY + offset;

  if (x + tooltipRect.width > viewportWidth) {
    x = e.clientX - tooltipRect.width - offset;
  }

  if (y + tooltipRect.height > viewportHeight) {
    y = e.clientY - tooltipRect.height - offset;
  }

  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
}
