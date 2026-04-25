export function createSelectionBox(container) {
  const box = document.createElement("div");

  const style = document.createElement("style");
  style.textContent = `
    @keyframes sel-dash {
      to { stroke-dashoffset: -20; }
    }
    .sel-box-svg {
      position: fixed;
      pointer-events: none;
      z-index: 999;
      overflow: visible;
      display: none;
    }
    .sel-box-svg rect.sel-fill {
      fill: rgba(109, 77, 202, 0.12);
    }
    .sel-box-svg rect.sel-border {
      fill: none;
      stroke: #7c5cbf;
      stroke-width: 1.5; 
      stroke-dasharray: 6 4;
      animation: sel-dash 0.5s linear infinite;
    }
    .sel-box-svg rect.sel-border-outer {
      fill: none;
      stroke: rgba(109, 77, 202, 0.35); 
      stroke-width: 3;
    }
  `;
  document.head.appendChild(style);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("sel-box-svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const outerRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  outerRect.classList.add("sel-border-outer");
  outerRect.setAttribute("rx", "4");

  const fillRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  fillRect.classList.add("sel-fill");
  fillRect.setAttribute("rx", "3");

  const borderRect = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  borderRect.classList.add("sel-border");
  borderRect.setAttribute("rx", "3");

  svg.appendChild(outerRect);
  svg.appendChild(fillRect);
  svg.appendChild(borderRect);
  document.body.appendChild(svg);

  let startX = 0,
    startY = 0;

  function _setRect(left, top, width, height) {
    svg.style.left = left + "px";
    svg.style.top = top + "px";
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    for (const r of [outerRect, fillRect, borderRect]) {
      r.setAttribute("x", "1");
      r.setAttribute("y", "1");
      r.setAttribute("width", Math.max(0, width - 2));
      r.setAttribute("height", Math.max(0, height - 2));
    }
  }

  function show(x, y) {
    startX = x;
    startY = y;
    svg.style.display = "block";
    _setRect(x, y, 0, 0);
  }

  function update(x, y) {
    const left = Math.min(x, startX);
    const top = Math.min(y, startY);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);
    _setRect(left, top, width, height);
  }

  function hide() {
    svg.style.display = "none";
  }

  function getRect() {
    return {
      left: parseFloat(svg.style.left),
      top: parseFloat(svg.style.top),
      right: parseFloat(svg.style.left) + parseFloat(svg.getAttribute("width")),
      bottom:
        parseFloat(svg.style.top) + parseFloat(svg.getAttribute("height")),
    };
  }

  function destroy() {
    svg.remove();
    style.remove();
  }

  return { show, update, hide, getRect, destroy };
}
