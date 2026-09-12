/**
 * Worksheet generator — client-only, no storage.
 * Extend SCRIPTS / STYLES when adding fonts or style rules later.
 */

const SCRIPTS = {
  manuscript: {
    label: "Manuscript",
    family: '"Handlee", "Segoe Print", "Comic Sans MS", cursive',
    className: "script-manuscript",
  },
  cursive: {
    label: "Cursive",
    family: '"Dancing Script", "Segoe Script", "Brush Script MT", cursive',
    className: "script-cursive",
  },
};

const STYLES = {
  solid: { label: "Solid", className: "style-solid", render: "text" },
  outline: { label: "Outline", className: "style-outline", render: "svg" },
  dotted: { label: "Dotted", className: "style-dotted", render: "svg" },
  faded: { label: "Faded", className: "style-faded", render: "text" },
};

/** Injected so @page size tracks A4 / Letter for print. */
let pageStyleEl = null;

function ensurePageStyle() {
  if (pageStyleEl) return pageStyleEl;
  pageStyleEl = document.createElement("style");
  pageStyleEl.id = "trace-page-size";
  document.head.appendChild(pageStyleEl);
  return pageStyleEl;
}

function setPrintPageSize(page) {
  const size = page === "letter" ? "letter" : "A4";
  ensurePageStyle().textContent = `@page { size: ${size}; margin: 0; }`;
}

const PLACEHOLDER = "Emma";

const els = {
  name: document.getElementById("name-input"),
  size: document.getElementById("size-input"),
  sizeValue: document.getElementById("size-value"),
  guides: document.getElementById("guides-input"),
  page: document.getElementById("worksheet-page"),
  lines: document.getElementById("worksheet-lines"),
  subtitle: document.getElementById("worksheet-subtitle"),
  print: document.getElementById("print-btn"),
};

function selectedValue(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
}

function getState() {
  const raw = (els.name?.value ?? "").trim();
  return {
    text: raw || PLACEHOLDER,
    isPlaceholder: !raw,
    script: selectedValue("script") || "manuscript",
    style: selectedValue("style") || "dotted",
    page: selectedValue("page") || "a4",
    size: Number(els.size?.value || 48),
    guides: Boolean(els.guides?.checked),
  };
}

const LINE_GAP = "   ";

function createWordNode(text, styleKey) {
  const style = STYLES[styleKey] || STYLES.dotted;
  const wrap = document.createElement("div");
  wrap.className = "worksheet-word";

  if (style.render === "svg") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "worksheet-word__svg");
    svg.setAttribute("aria-hidden", "true");

    const svgText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    svgText.setAttribute("x", "0");
    svgText.setAttribute("y", "50%");
    svgText.textContent = text;
    svg.appendChild(svgText);
    wrap.appendChild(svg);
  } else {
    const span = document.createElement("span");
    span.className = "worksheet-word__text";
    span.textContent = text;
    wrap.appendChild(span);
  }

  return wrap;
}

function createRow(text, styleKey) {
  const row = document.createElement("div");
  row.className = "worksheet-row";

  const guides = document.createElement("div");
  guides.className = "worksheet-row__guides";
  guides.setAttribute("aria-hidden", "true");
  guides.appendChild(document.createElement("span"));
  row.appendChild(guides);
  row.appendChild(createWordNode(text, styleKey));
  return row;
}

/** Intrinsic width of rendered line text (ignores the 100% row stretch). */
function measureTextWidth(text, styleKey) {
  const probe = createRow(text, styleKey);
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.left = "0";
  probe.style.top = "0";

  const word = probe.querySelector(".worksheet-word");
  if (word) word.style.width = "max-content";

  els.lines.appendChild(probe);

  let width = 0;
  const svgText = word?.querySelector("text");
  if (svgText && typeof svgText.getComputedTextLength === "function") {
    width = svgText.getComputedTextLength();
  } else if (word) {
    width = word.getBoundingClientRect().width;
  }

  probe.remove();
  return width;
}

/** How many times `text` fits across the line (with gaps), at least 1. */
function repeatsAcrossLine(text, styleKey) {
  const available = els.lines.clientWidth;
  const one = measureTextWidth(text, styleKey);
  if (!one || !available) return 1;

  const two = measureTextWidth(`${text}${LINE_GAP}${text}`, styleKey);
  const gap = Math.max(0, two - one * 2);
  const unit = one + gap;

  return Math.max(1, Math.floor((available + gap) / unit));
}

function lineText(text, styleKey) {
  const count = repeatsAcrossLine(text, styleKey);
  return Array.from({ length: count }, () => text).join(LINE_GAP);
}

function applyPageClasses(state) {
  const script = SCRIPTS[state.script] || SCRIPTS.manuscript;
  const style = STYLES[state.style] || STYLES.dotted;

  els.page.className = [
    "worksheet-page",
    state.page === "letter" ? "page-letter" : "page-a4",
    script.className,
    style.className,
    state.guides ? "show-guides" : "",
  ]
    .filter(Boolean)
    .join(" ");

  els.page.style.setProperty("--ws-font-size", `${state.size}px`);
  els.page.style.setProperty("--ws-line-gap", `${Math.max(10, state.size * 0.28)}px`);
}

function fitPreviewScale() {
  const frame = els.page?.parentElement;
  if (!frame || !els.page) return;

  els.page.style.transform = "none";
  const pageWidth = els.page.offsetWidth;
  const available = frame.clientWidth - 8;
  if (!pageWidth || available <= 0) return;

  const scale = Math.min(1, available / pageWidth);
  els.page.style.transform = scale < 0.999 ? `scale(${scale})` : "none";
  frame.style.minHeight = `${els.page.offsetHeight * scale + 8}px`;
}

function fillPage(state) {
  els.lines.replaceChildren();

  if (state.isPlaceholder) {
    els.subtitle.textContent = "Enter a name to begin";
  } else {
    els.subtitle.textContent = state.text;
  }

  const filled = lineText(state.text, state.style);

  // Probe one row to measure height, then fill.
  const probe = createRow(filled, state.style);
  els.lines.appendChild(probe);

  const available = els.lines.clientHeight;
  const rowHeight = probe.getBoundingClientRect().height;
  const styles = getComputedStyle(els.lines);
  const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;

  let count = 1;
  if (rowHeight > 0 && available > 0) {
    count = Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
  }

  els.lines.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    els.lines.appendChild(createRow(filled, state.style));
  }
}

function render() {
  if (!els.page || !els.lines) return;

  const state = getState();
  if (els.sizeValue) els.sizeValue.textContent = String(state.size);

  applyPageClasses(state);
  setPrintPageSize(state.page);
  fillPage(state);
  fitPreviewScale();
}

function bind() {
  const rerender = () => render();

  els.name?.addEventListener("input", rerender);
  els.size?.addEventListener("input", rerender);
  els.guides?.addEventListener("change", rerender);

  document.querySelectorAll('input[name="script"], input[name="style"], input[name="page"]').forEach((input) => {
    input.addEventListener("change", rerender);
  });

  els.print?.addEventListener("click", () => {
    window.print();
  });

  window.addEventListener("resize", () => {
    fitPreviewScale();
  });

  // Re-measure after fonts load so row count stays accurate.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => render());
  }

  const printMq = window.matchMedia("print");
  const syncPrintTransform = () => {
    if (printMq.matches) {
      els.page.style.transform = "none";
    } else {
      fitPreviewScale();
    }
  };
  printMq.addEventListener?.("change", syncPrintTransform);
  window.addEventListener("beforeprint", () => {
    els.page.style.transform = "none";
  });
  window.addEventListener("afterprint", () => {
    fitPreviewScale();
  });
}

bind();
render();

export { SCRIPTS, STYLES };
