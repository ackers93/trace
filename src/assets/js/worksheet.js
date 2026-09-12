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
  guides: { label: "Guides only", className: "style-guides-only" },
};

const DOTTED_STYLES = new Set(["dotted", "faded-dots"]);
const PLACEHOLDER = "Emma";
const LINE_GAP = "    ";
/** Defaults for the first rows; any extra page rows become guides-only. */
const DEFAULT_PATTERN = ["solid", "faded", "dotted", "faded-dots", "guides"];

function defaultStyleForIndex(index) {
  return DEFAULT_PATTERN[index] ?? "guides";
}

/** Grow/shrink the pattern to match how many rows fit on the page. */
function syncLinePatternLength(count) {
  const target = Math.max(1, count);
  let changed = false;

  while (linePattern.length < target) {
    linePattern.push(defaultStyleForIndex(linePattern.length));
    changed = true;
  }
  if (linePattern.length > target) {
    linePattern.length = target;
    changed = true;
  }

  return changed;
}

/** Injected so @page size tracks A4 / Letter for print. */
let pageStyleEl = null;
let measureCtx = null;
/** @type {string[]} */
let linePattern = [...DEFAULT_PATTERN];
/** @type {string[]} */
let pageWords = [""];

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
  size: document.getElementById("size-input"),
  sizeValue: document.getElementById("size-value"),
  guides: document.getElementById("guides-input"),
  linePattern: document.getElementById("line-pattern"),
  pagesList: document.getElementById("pages-list"),
  pages: document.getElementById("worksheet-pages"),
  print: document.getElementById("print-btn"),
};

function selectedValue(name) {
  const input = document.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
}

function normalizeStyle(key) {
  return STYLES[key] ? key : "dotted";
}

function getState() {
  const pattern = linePattern.length ? linePattern.map(normalizeStyle) : ["dotted"];
  const words = pageWords.length ? pageWords : [""];
  return {
    words,
    script: selectedValue("script") || "manuscript",
    pattern,
    page: selectedValue("page") || "a4",
    size: Number(els.size?.value || 48),
    guides: Boolean(els.guides?.checked),
  };
}

function scriptFontFamily(state) {
  const script = SCRIPTS[state.script] || SCRIPTS.manuscript;
  return script.family;
}

function fontFamilyForStyle(state, styleKey) {
  if (DOTTED_STYLES.has(styleKey)) return DOTTED_FAMILY;
  return scriptFontFamily(state);
}

function pageShellClass(state) {
  const script = SCRIPTS[state.script] || SCRIPTS.manuscript;
  return [
    "worksheet-page",
    state.page === "letter" ? "page-letter" : "page-a4",
    script.className,
    state.guides ? "show-guides" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function applyPageShell(pageEl, state) {
  pageEl.className = pageShellClass(state);
  pageEl.style.setProperty("--ws-font-size", `${state.size}px`);
  pageEl.style.setProperty("--ws-line-gap", `${Math.max(16, state.size * 0.3)}px`);
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

function applyGuideMetrics(pageEl, metrics) {
  const s = pageEl.style;
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

function createRow(text, metrics, styleKey) {
  const style = STYLES[styleKey] || STYLES.dotted;
  const row = document.createElement("div");
  row.className = ["worksheet-row", style.className].filter(Boolean).join(" ");

  const guides = document.createElement("div");
  guides.className = "worksheet-row__guides";
  guides.setAttribute("aria-hidden", "true");

  for (const kind of ["top", "mid", "base", "desc"]) {
    const line = document.createElement("span");
    line.className = `worksheet-row__guide worksheet-row__guide--${kind}`;
    guides.appendChild(line);
  }

  row.appendChild(guides);

  if (styleKey !== "guides") {
    row.appendChild(createWordNode(text, metrics));
  }

  return row;
}

function measureTextWidth(hostLines, text, metrics) {
  const probe = createRow(text, metrics, "solid");
  // Keep the probe in-flow but invisible so it never expands document scrollports.
  probe.style.cssText =
    "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;width:max-content";
  const word = probe.querySelector(".worksheet-word");
  if (word) word.style.width = "max-content";

  const prevPosition = hostLines.style.position;
  if (getComputedStyle(hostLines).position === "static") {
    hostLines.style.position = "relative";
  }

  hostLines.appendChild(probe);
  const svgText = word?.querySelector("text");
  const width =
    svgText && typeof svgText.getComputedTextLength === "function"
      ? svgText.getComputedTextLength()
      : word?.getBoundingClientRect().width || 0;
  probe.remove();
  hostLines.style.position = prevPosition;
  return width;
}

function repeatsAcrossLine(hostLines, text, metrics) {
  const available = hostLines.clientWidth;
  const one = measureTextWidth(hostLines, text, metrics);
  if (!one || !available) return 1;

  const two = measureTextWidth(hostLines, `${text}${LINE_GAP}${text}`, metrics);
  const gap = Math.max(0, two - one * 2);
  return Math.max(1, Math.floor((available + gap) / (one + gap)));
}

function lineText(hostLines, text, metrics) {
  const count = repeatsAcrossLine(hostLines, text, metrics);
  return Array.from({ length: count }, () => text).join(LINE_GAP);
}

function fitPreviewScale() {
  const frame = els.pages;
  if (!frame) return;

  const pages = [...frame.querySelectorAll(".worksheet-page")];
  if (!pages.length) return;

  const available = Math.max(0, frame.clientWidth - 8);

  pages.forEach((page) => {
    const shell = ensurePageScaleShell(page);

    // Natural paper size (absolute positioning keeps this out of document flow)
    page.style.transform = "none";
    const width = page.offsetWidth;
    const height = page.offsetHeight;
    if (!width || !height) return;

    const scale = available > 0 ? Math.min(1, available / width) : 1;
    shell.style.width = `${width * scale}px`;
    shell.style.height = `${height * scale}px`;
    page.style.transformOrigin = "top left";
    page.style.transform = scale < 0.999 ? `scale(${scale})` : "none";
  });
}

function ensurePageScaleShell(page) {
  let shell = page.parentElement;
  if (!shell?.classList.contains("worksheet-page-scale")) {
    shell = document.createElement("div");
    shell.className = "worksheet-page-scale";
    page.replaceWith(shell);
    shell.appendChild(page);
  }
  return shell;
}

function metricsForStyle(state, styleKey, baseMetrics) {
  const family = fontFamilyForStyle(state, styleKey);
  if (family === baseMetrics.fontFamily) return baseMetrics;
  return { ...baseMetrics, fontFamily: family };
}

function createPageElement() {
  const page = document.createElement("div");
  page.className = "worksheet-page";
  page.setAttribute("aria-live", "polite");

  const header = document.createElement("div");
  header.className = "worksheet-page__header";

  const title = document.createElement("span");
  title.className = "worksheet-page__title";
  title.textContent = "Print&Trace";

  const subtitle = document.createElement("span");
  subtitle.className = "worksheet-page__subtitle";

  header.append(title, subtitle);

  const lines = document.createElement("div");
  lines.className = "worksheet-page__lines";

  page.append(header, lines);
  return { page, subtitle, lines };
}

function countFittingRows(linesEl, state, baseMetrics) {
  const probeStyle = state.pattern.find((key) => key !== "guides") || "solid";
  const probeMetrics = metricsForStyle(state, probeStyle, baseMetrics);
  const probe = createRow(PLACEHOLDER, probeMetrics, probeStyle);
  linesEl.replaceChildren();
  linesEl.appendChild(probe);

  const available = linesEl.clientHeight;
  const rowHeight = probe.getBoundingClientRect().height || baseMetrics.rowHeight;
  const styles = getComputedStyle(linesEl);
  const gap = parseFloat(styles.rowGap || styles.gap || "0") || 0;

  probe.remove();

  if (rowHeight > 0 && available > 0) {
    return Math.max(1, Math.floor((available + gap) / (rowHeight + gap)));
  }
  return 1;
}

function fillPage(pageEl, linesEl, subtitleEl, state, baseMetrics, rawWord, rowCount) {
  const text = rawWord.trim() || PLACEHOLDER;
  const isPlaceholder = !rawWord.trim();

  linesEl.replaceChildren();
  subtitleEl.textContent = isPlaceholder ? "Enter a name to begin" : text;

  const pattern = state.pattern;
  const textByStyle = new Map();
  for (const styleKey of pattern) {
    if (styleKey === "guides" || textByStyle.has(styleKey)) continue;
    const metrics = metricsForStyle(state, styleKey, baseMetrics);
    textByStyle.set(styleKey, lineText(linesEl, text, metrics));
  }

  for (let i = 0; i < rowCount; i += 1) {
    const styleKey = pattern[i] ?? defaultStyleForIndex(i);
    const metrics = metricsForStyle(state, styleKey, baseMetrics);
    const filled = styleKey === "guides" ? "" : textByStyle.get(styleKey) || text;
    linesEl.appendChild(createRow(filled, metrics, styleKey));
  }
}

async function ensureScriptFont(state) {
  if (!document.fonts?.load) return;
  const families = new Set([scriptFontFamily(state)]);
  if (state.pattern.some((key) => DOTTED_STYLES.has(key))) {
    families.add(DOTTED_FAMILY);
  }
  try {
    await Promise.all([...families].map((family) => document.fonts.load(`${state.size}px ${family}`)));
    await document.fonts.ready;
  } catch {
    /* keep going with fallbacks */
  }
}

function styleOptionsHtml(selected) {
  return Object.entries(STYLES)
    .map(
      ([value, meta]) =>
        `<option value="${value}"${value === selected ? " selected" : ""}>${meta.label}</option>`,
    )
    .join("");
}

function renderLinePatternEditor() {
  if (!els.linePattern) return;

  const active = document.activeElement;
  const activeIndex =
    active instanceof HTMLSelectElement && active.dataset.lineIndex != null
      ? Number(active.dataset.lineIndex)
      : null;

  els.linePattern.replaceChildren();

  linePattern.forEach((styleKey, index) => {
    const row = document.createElement("div");
    row.className = "line-pattern__row";

    const label = document.createElement("span");
    label.className = "line-pattern__index";
    label.textContent = String(index + 1);

    const select = document.createElement("select");
    select.className = "field__input line-pattern__select";
    select.dataset.lineIndex = String(index);
    select.setAttribute("aria-label", `Line ${index + 1} style`);
    select.innerHTML = styleOptionsHtml(normalizeStyle(styleKey));
    select.addEventListener("change", () => {
      linePattern[index] = normalizeStyle(select.value);
      render();
    });

    row.append(label, select);
    els.linePattern.appendChild(row);
  });

  if (activeIndex != null && Number.isFinite(activeIndex)) {
    const next = els.linePattern.querySelector(`select[data-line-index="${activeIndex}"]`);
    next?.focus();
  }
}

function renderPagesEditor() {
  if (!els.pagesList) return;

  const active = document.activeElement;
  const activeIndex =
    active instanceof HTMLInputElement && active.dataset.pageIndex != null
      ? Number(active.dataset.pageIndex)
      : null;
  const selectionStart = active instanceof HTMLInputElement ? active.selectionStart : null;
  const selectionEnd = active instanceof HTMLInputElement ? active.selectionEnd : null;

  els.pagesList.replaceChildren();

  pageWords.forEach((word, index) => {
    const row = document.createElement("div");
    row.className = "pages-list__row";

    const label = document.createElement("span");
    label.className = "line-pattern__index";
    label.textContent = String(index + 1);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "field__input";
    input.placeholder = PLACEHOLDER;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 40;
    input.value = word;
    input.dataset.pageIndex = String(index);
    input.setAttribute("aria-label", `Page ${index + 1} word`);
    input.addEventListener("input", () => {
      pageWords[index] = input.value;
      render();
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost";
    remove.textContent = "Remove";
    remove.disabled = pageWords.length <= 1;
    remove.addEventListener("click", () => {
      if (pageWords.length <= 1) return;
      pageWords.splice(index, 1);
      renderPagesEditor();
      render();
    });

    row.append(label, input, remove);
    els.pagesList.appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "line-pattern__actions";

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn btn--ghost";
  add.textContent = "Add page";
  add.addEventListener("click", () => {
    pageWords.push("");
    renderPagesEditor();
    render();
    const inputs = els.pagesList.querySelectorAll("input");
    const last = inputs[inputs.length - 1];
    last?.focus();
  });

  actions.appendChild(add);
  els.pagesList.appendChild(actions);

  if (activeIndex != null && Number.isFinite(activeIndex)) {
    const next = els.pagesList.querySelector(`input[data-page-index="${activeIndex}"]`);
    if (next instanceof HTMLInputElement) {
      next.focus();
      if (selectionStart != null && selectionEnd != null) {
        next.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

async function render() {
  if (!els.pages) return;

  let state = getState();
  if (els.sizeValue) els.sizeValue.textContent = String(state.size);

  setPrintPageSize(state.page);
  await ensureScriptFont(state);

  // Guide geometry stays on the script face so mixed styles share one staff height.
  const metrics = measureGuideMetrics(scriptFontFamily(state), state.size);

  els.pages.replaceChildren();

  // Measure once on a live page shell so the pattern picker matches printable rows.
  const probe = createPageElement();
  applyPageShell(probe.page, state);
  applyGuideMetrics(probe.page, metrics);
  const probeShell = document.createElement("div");
  probeShell.className = "worksheet-page-scale";
  probeShell.appendChild(probe.page);
  els.pages.appendChild(probeShell);

  const rowCount = countFittingRows(probe.lines, state, metrics);
  if (syncLinePatternLength(rowCount)) {
    renderLinePatternEditor();
    state = getState();
  }

  els.pages.replaceChildren();

  state.words.forEach((word) => {
    const { page, subtitle, lines } = createPageElement();
    applyPageShell(page, state);
    applyGuideMetrics(page, metrics);
    // Wrap before insert so the paper’s mm/in width never widens the layout.
    const shell = document.createElement("div");
    shell.className = "worksheet-page-scale";
    shell.appendChild(page);
    els.pages.appendChild(shell);
    fillPage(page, lines, subtitle, state, metrics, word, rowCount);
  });

  fitPreviewScale();
}

function bind() {
  const rerender = () => {
    render();
  };

  els.size?.addEventListener("input", rerender);
  els.guides?.addEventListener("change", rerender);

  document.querySelectorAll('input[name="script"], input[name="page"]').forEach((input) => {
    input.addEventListener("change", rerender);
  });

  els.print?.addEventListener("click", () => window.print());
  window.addEventListener("resize", () => fitPreviewScale());

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => render());
  }

  const printMq = window.matchMedia("print");
  const preparePrint = () => {
    els.pages?.querySelectorAll(".worksheet-page").forEach((page) => {
      page.style.transform = "none";
      page.style.position = "";
      page.style.left = "";
      page.style.top = "";
    });
    els.pages?.querySelectorAll(".worksheet-page-scale").forEach((shell) => {
      shell.style.width = "";
      shell.style.height = "";
    });
  };
  printMq.addEventListener?.("change", () => {
    if (printMq.matches) preparePrint();
    else fitPreviewScale();
  });
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", () => fitPreviewScale());
}

renderLinePatternEditor();
renderPagesEditor();
bind();
render();

export { SCRIPTS, STYLES };
