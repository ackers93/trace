/**
 * Worksheet generator — client-only, no storage.
 * Extend SCRIPTS / STYLES when adding fonts or style rules later.
 */

const SCRIPTS = {
  manuscript: {
    label: "Manuscript",
    family: '"Edu AU VIC WA NT Hand", "Segoe Print", "Comic Sans MS", cursive',
    className: "script-manuscript",
  },
  cursive: {
    label: "Cursive",
    family: '"Dancing Script", "Segoe Script", "Brush Script MT", cursive',
    className: "script-cursive",
  },
};

/** Purpose-built dotted tracing face (Google Fonts, OFL). */
const DOTTED_FAMILY = '"Edu AU VIC WA NT Dots", "Edu AU VIC WA NT Hand", cursive';

const STYLES = {
  solid: { label: "Solid", className: "style-solid" },
  outline: { label: "Outline", className: "style-outline" },
  dotted: { label: "Dotted", className: "style-dotted" },
  "faded-dots": { label: "Faded dots", className: "style-faded-dots" },
  faded: { label: "Faded", className: "style-faded" },
};

const PLACEHOLDER = "Emma";
const LINE_GAP = "    ";

/** Injected so @page size tracks A4 / Letter for print. */
let pageStyleEl = null;
let measureCtx = null;

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

function activeFontFamily(state) {
  if (state.style === "dotted" || state.style === "faded-dots") return DOTTED_FAMILY;
  const script = SCRIPTS[state.script] || SCRIPTS.manuscript;
  return script.family;
}

function applyPageShell(state) {
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
  els.page.style.setProperty("--ws-line-gap", `${Math.max(16, state.size * 0.3)}px`);
}

function getMeasureCtx() {
  if (measureCtx) return measureCtx;
  const canvas = document.createElement("canvas");
  measureCtx = canvas.getContext("2d");
  return measureCtx;
}

/**
 * Build a primary handwriting staff from canvas glyph metrics.
 * top = capital top, mid = x-height, base = baseline, desc = descenders.
 */
function measureGuideMetrics(fontFamily, fontSize) {
  const ctx = getMeasureCtx();
  ctx.font = `${fontSize}px ${fontFamily}`;

  const cap = ctx.measureText("H");
  const ex = ctx.measureText("x");
  const dee = ctx.measureText("g");

  const capAscent = Math.max(fontSize * 0.55, cap.actualBoundingBoxAscent || fontSize * 0.75);
  const xAscent = Math.max(fontSize * 0.3, ex.actualBoundingBoxAscent || capAscent * 0.55);
  const descent = Math.max(fontSize * 0.2, dee.actualBoundingBoxDescent || fontSize * 0.28);

  const pad = Math.round(fontSize * 0.2);
  const top = pad;
  const base = pad + capAscent;
  // Mid sits at the top of lowercase letters.
  let mid = base - xAscent;
  // Keep mid clearly between top and baseline.
  mid = Math.min(base - fontSize * 0.2, Math.max(top + fontSize * 0.12, mid));
  const desc = base + descent;
  const rowHeight = Math.ceil(desc + pad);

  return { top, mid, base, desc, rowHeight, fontSize, fontFamily, pad };
}

function applyGuideMetrics(metrics) {
  const s = els.page.style;
  s.setProperty("--ws-row-height", `${metrics.rowHeight}px`);
  s.setProperty("--ws-guide-top", `${metrics.top}px`);
  s.setProperty("--ws-guide-mid", `${metrics.mid}px`);
  s.setProperty("--ws-guide-base", `${metrics.base}px`);
  s.setProperty("--ws-guide-desc", `${metrics.desc}px`);
}

function appendSvgText(svg, text, metrics) {
  const svgText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  svgText.setAttribute("x", "0");
  svgText.setAttribute("y", String(metrics.base));
  svgText.setAttribute("dominant-baseline", "alphabetic");
  svgText.setAttribute("font-size", String(metrics.fontSize));
  svgText.setAttribute("font-family", metrics.fontFamily);
  svgText.textContent = text;
  svg.appendChild(svgText);
  return svgText;
}

function createWordNode(text, metrics) {
  const wrap = document.createElement("div");
  wrap.className = "worksheet-word";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "worksheet-word__svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("height", String(metrics.rowHeight));
  svg.style.height = `${metrics.rowHeight}px`;
  appendSvgText(svg, text, metrics);
  wrap.appendChild(svg);
  return wrap;
}

function createRow(text, metrics) {
  const row = document.createElement("div");
  row.className = "worksheet-row";

  const guides = document.createElement("div");
  guides.className = "worksheet-row__guides";
  guides.setAttribute("aria-hidden", "true");

  for (const kind of ["top", "mid", "base", "desc"]) {
    const line = document.createElement("span");
    line.className = `worksheet-row__guide worksheet-row__guide--${kind}`;
    guides.appendChild(line);
  }

  row.appendChild(guides);
  row.appendChild(createWordNode(text, metrics));
  return row;
}

function measureTextWidth(text, metrics) {
  const probe = createRow(text, metrics);
  probe.style.cssText = "position:absolute;left:-9999px;top:0;pointer-events:none";
  const word = probe.querySelector(".worksheet-word");
  if (word) word.style.width = "max-content";

  els.lines.appendChild(probe);
  const svgText = word?.querySelector("text");
  const width =
    svgText && typeof svgText.getComputedTextLength === "function"
      ? svgText.getComputedTextLength()
      : word?.getBoundingClientRect().width || 0;
  probe.remove();
  return width;
}

function repeatsAcrossLine(text, metrics) {
  const available = els.lines.clientWidth;
  const one = measureTextWidth(text, metrics);
  if (!one || !available) return 1;

  const two = measureTextWidth(`${text}${LINE_GAP}${text}`, metrics);
  const gap = Math.max(0, two - one * 2);
  return Math.max(1, Math.floor((available + gap) / (one + gap)));
}

function lineText(text, metrics) {
  const count = repeatsAcrossLine(text, metrics);
  return Array.from({ length: count }, () => text).join(LINE_GAP);
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

function fillPage(state, metrics) {
  els.lines.replaceChildren();

  els.subtitle.textContent = state.isPlaceholder ? "Enter a name to begin" : state.text;

  const filled = lineText(state.text, metrics);
  const probe = createRow(filled, metrics);
  els.lines.appendChild(probe);

  const available = els.lines.clientHeight;
  const rowHeight = probe.getBoundingClientRect().height || metrics.rowHeight;
  const styles = getComputedStyle(els.lines);
  const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;

  let count = 1;
  if (rowHeight > 0 && available > 0) {
    count = Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
  }

  els.lines.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    els.lines.appendChild(createRow(filled, metrics));
  }
}

async function ensureScriptFont(state) {
  const family = activeFontFamily(state);
  if (!document.fonts?.load) return;
  try {
    await document.fonts.load(`${state.size}px ${family}`);
    await document.fonts.ready;
  } catch {
    /* keep going with fallbacks */
  }
}

async function render() {
  if (!els.page || !els.lines) return;

  const state = getState();
  if (els.sizeValue) els.sizeValue.textContent = String(state.size);

  applyPageShell(state);
  setPrintPageSize(state.page);
  await ensureScriptFont(state);

  const metrics = measureGuideMetrics(activeFontFamily(state), state.size);
  applyGuideMetrics(metrics);
  fillPage(state, metrics);
  fitPreviewScale();
}

function bind() {
  const rerender = () => {
    render();
  };

  els.name?.addEventListener("input", rerender);
  els.size?.addEventListener("input", rerender);
  els.guides?.addEventListener("change", rerender);

  document.querySelectorAll('input[name="script"], input[name="style"], input[name="page"]').forEach((input) => {
    input.addEventListener("change", rerender);
  });

  els.print?.addEventListener("click", () => window.print());
  window.addEventListener("resize", () => fitPreviewScale());

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => render());
  }

  const printMq = window.matchMedia("print");
  printMq.addEventListener?.("change", () => {
    if (printMq.matches) els.page.style.transform = "none";
    else fitPreviewScale();
  });
  window.addEventListener("beforeprint", () => {
    els.page.style.transform = "none";
  });
  window.addEventListener("afterprint", () => fitPreviewScale());
}

bind();
render();

export { SCRIPTS, STYLES };
