/* EasySci: a curated, searchable directory. #/easysci lists tools; #/easysci/:slug remains a direct detail route. */
(function () {
  const A = window.Aloop = window.Aloop || {};
  const I18N = {
    zh: {
      title: "科研与创作工具，一站检索。",
      sub: "面向心理学与跨学科科研的 Agent 工具目录，集中整理 Skill、MCP 服务与 Agent 插件，并保留文献、数据、实验、设计和创作等任务领域筛选。",
      search: "搜索工具名称、任务、分类或能力",
      all: "全部资源", allSkills: "Skill", allMcp: "MCP", allAccess: "全部使用模式", sort: "排序", name: "名称 A–Z", picks: "优先精选", categorySort: "按领域", kind: "资源类型", domain: "任务领域", skills: "Skill", mcp: "MCP", plugin: "Agent 插件包", resource: "网页工具", skillIncluded: "含 Skill", mcpIncluded: "含 MCP", platforms: "适配客户端", installation: "安装方式", connection: "接入方式", featured: "精选",
      clear: "重置筛选", empty: "没有匹配的工具。请尝试调整关键词或筛选条件。", total: "全部资源", results: "当前结果", tools: "项资源",
      free: "免费", freemium: "免费增值", paid: "付费", openSource: "开源", access: "使用模式", category: "分类",
      details: "查看详细说明", hideDetails: "收起说明", visit: "访问官方网站", detailPage: "独立详情页", back: "← 返回 EasySci", docs: "官方文档", sourceCode: "源代码仓库",
      useCases: "典型用途", strengths: "适用优势", limitations: "注意事项与限制", signIn: "是否需要账号", freeTier: "免费层与额度", license: "许可与商用提示", verification: "信息核验状态", pending: "需人工复核", checked: "已核验",
      verifyNote: "工具目录为编辑整理的候选清单，不代表全网排名。部分官网链接、收费档位和授权细节尚未逐项完成实时人工核验；使用前请以服务官方页面及具体素材许可为准。",
      rankNote: "流量排名仅适用于 Similarweb 所列的“Graphics, Multimedia and Web Design”分类与对应月份，不是质量或适用性排名。",
      source: "来源与核验", dateAdded: "收录日期", noSource: "未提供单独文档链接", related: "同类工具", notfound: "没有找到该工具。", footer: "EasySci 是人工整理的工具索引。统计数量来自当前目录数据；收费与许可条件可能变化。",
      exact: "官网域名", verified: "最后核验日期", noDate: "尚未完成逐项核验", modelCounts: "当前候选结果中的使用模式数量", kindHeading: "按能力形式筛选", domainHeading: "按研究任务筛选", filterHint: "优先按 Skill / MCP 浏览；任务领域可进一步缩小范围。", pluginHint: "Agent 插件可以同时打包 Skill 与 MCP，因此可能同时出现在两个能力筛选中。", installLabel: "安装提示", commandLabel: "命令示例", inspectBeforeUse: "安装前请核对来源、权限、数据范围与最新文档。"
    },
    en: {
      title: "Research and creative tools, searchable in one place.",
      sub: "An agent-tool directory for psychology and interdisciplinary research, with Skills, MCP servers, and agent plugins organized across literature, data, experiments, design, and creative workflows.",
      search: "Search by tool, task, category, or capability",
      all: "All resources", allSkills: "Skill", allMcp: "MCP", allAccess: "All access models", sort: "Sort", name: "Name A–Z", picks: "Featured first", categorySort: "Domain", kind: "Resource type", domain: "Task domain", skills: "Skill", mcp: "MCP", plugin: "Agent Plugin Bundle", resource: "Web tool", skillIncluded: "Includes Skill", mcpIncluded: "Includes MCP", platforms: "Compatible clients", installation: "Install", connection: "Connection", featured: "Featured",
      clear: "Reset filters", empty: "No matching tools. Try changing the search term or filters.", total: "All resources", results: "Results", tools: "resources",
      free: "Free", freemium: "Freemium", paid: "Paid", openSource: "Open Source", access: "Access model", category: "Category",
      details: "Show details", hideDetails: "Hide details", visit: "Visit Official Website", detailPage: "Full detail page", back: "← Back to EasySci", docs: "Official documentation", sourceCode: "Source repository",
      useCases: "Typical use cases", strengths: "Strengths", limitations: "Limitations and cautions", signIn: "Sign-in requirements", freeTier: "Free tier and limits", license: "License and commercial-use note", verification: "Verification status", pending: "Manual review needed", checked: "Verified",
      verifyNote: "This is an editorially curated shortlist, not a universal ranking. Some official destinations, pricing tiers, and license details have not yet received individual live manual verification. Confirm details on the official service page and review each asset license before use.",
      rankNote: "Traffic rank applies only to Similarweb’s “Graphics, Multimedia and Web Design” category and the stated month; it is not a quality or suitability ranking.",
      source: "Sources and verification", dateAdded: "Added", noSource: "No separate documentation link provided", related: "Related tools", notfound: "Tool not found.", footer: "EasySci is an editorially curated tool index. Counts are derived from current directory data; prices and license terms may change.",
      exact: "Official domain", verified: "Last verified", noDate: "Item-level verification pending", modelCounts: "Access-model counts in the current candidate set", kindHeading: "Filter by capability format", domainHeading: "Filter by task domain", filterHint: "Browse by Skill / MCP first, then narrow by research task.", pluginHint: "Agent plugins can bundle both Skills and MCP, so a plugin may appear in both capability filters.", installLabel: "Setup notes", commandLabel: "Example command", inspectBeforeUse: "Review provenance, permissions, data scope, and current docs before installing."
    }
  };
  const L = () => A.i18n && A.i18n.lang === "en" ? "en" : "zh";
  const t = key => I18N[L()][key] || key;
  const root = document.getElementById("easysciView");
  const PAGE_SIZE = 50;
  const state = { q: "", kind: "all", cat: "all", access: "all", sort: "picks", expanded: new Set(), visibleLimit: PAGE_SIZE };
  const modelOrder = ["Free", "Freemium", "Paid", "Open Source"];
  const modelLabel = { Free: "free", Freemium: "freemium", Paid: "paid", "Open Source": "openSource" };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function safeUrl(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
      return url.href;
    } catch (_) { return null; }
  }
  function domainOf(raw) {
    try { return new URL(raw).hostname.replace(/^www\./, ""); } catch (_) { return raw; }
  }
  function validTools() {
    const tools = A.easysciData?.tools || [];
    return tools.filter(x => x && /^[a-z0-9-]+$/.test(x.slug || x.id || "") && x.name && safeUrl(x.officialUrl));
  }
  function categoryLabel(key) {
    const item = A.easysciData.categories[key];
    return item ? item[L() === "en" ? 1 : 0] : key;
  }
  function modelName(value) { return t(modelLabel[value] || value); }
  function kindOf(item) { return item.kind || "resource"; }
  function capabilitiesOf(item) {
    if (Array.isArray(item.capabilities) && item.capabilities.length) return item.capabilities;
    return kindOf(item) === "skill" || kindOf(item) === "mcp" ? [kindOf(item)] : [];
  }
  function kindLabel(item) {
    const k = kindOf(item);
    return t(k === "plugin" ? "plugin" : k === "mcp" ? "mcp" : k === "skill" ? "skills" : "resource");
  }
  function hasCapability(item, kind) { return capabilitiesOf(item).includes(kind); }
  function displayCapabilities(item) {
    if (kindOf(item) !== "plugin") return "";
    return capabilitiesOf(item).map(k => t(k === "skill" ? "skillIncluded" : "mcpIncluded")).join(" · ");
  }
  function modelsOf(item) { return Array.isArray(item.accessModels) ? item.accessModels : (item.openSource ? ["Free", "Open Source"] : ["Free"]); }
  function localized(obj, fallback = "") { return typeof obj === "string" ? obj : (obj?.[L()] || obj?.zh || obj?.en || fallback); }
  function descriptionOf(item) { return item.summary || item.description || {}; }
  function summaryOf(item) { return localized(descriptionOf(item), item.name); }
  function detailsOf(item) { return localized(item.details, summaryOf(item)); }
  function detailHref(item) { return `#/easysci/${encodeURIComponent(item.slug || item.id)}`; }
  function badge(model) { return `<span class="es-badge es-badge-${model === "Open Source" ? "oss" : model.toLowerCase()}" title="${esc(modelName(model))}">${esc(modelName(model))}</span>`; }
  function capabilityBadge(kind) {
    return `<span class="es-badge es-badge-capability es-badge-${esc(kind)}">${esc(t(kind === "skill" ? "skills" : "mcp"))}</span>`;
  }
  function badges(item) {
    const access = modelsOf(item).map(badge).join("");
    const caps = kindOf(item) === "plugin" ? capabilitiesOf(item).map(capabilityBadge).join("") : "";
    return access + caps;
  }
  function setupBlock(item) {
    const install = localized(item.installation);
    const connection = install ? "" : localized(item.connectionInfo);
    const command = String(item.installCommand || "").trim();
    if (!install && !connection && !command) return "";
    return `<aside class="es-install-info"><strong>${esc(t("installLabel"))}</strong>${install ? `<p>${esc(install)}</p>` : ""}${connection ? `<p>${esc(connection)}</p>` : ""}${command ? `<span class="es-code-label">${esc(t("commandLabel"))}</span><code>${esc(command)}</code>` : ""}<small>${esc(t("inspectBeforeUse"))}</small></aside>`;
  }
  function ext(raw, label, className = "es-action") {
    const url = safeUrl(raw);
    if (!url) return "";
    return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
  }
  function findBySlug(slug) { return validTools().find(x => (x.slug || x.id) === slug) || null; }
  function searchBlob(item) {
    return [item.name, item.type, item.kind, kindLabel(item), displayCapabilities(item), item.category, categoryLabel(item.category), summaryOf(item), detailsOf(item),
      localized(item.useCases), localized(item.strengths), localized(item.limitations), localized(item.installation), localized(item.connectionInfo), localized(item.platforms), item.installCommand,
      ...(item.tags || []), ...(item.capabilities || []), ...(modelsOf(item))].join(" ").toLowerCase();
  }
  function matchesBase(item, ignoreAccess = false, ignoreCategory = false, ignoreKind = false) {
    const q = state.q.trim().toLocaleLowerCase();
    if (q && !searchBlob(item).toLocaleLowerCase().includes(q)) return false;
    if (!ignoreCategory && state.cat !== "all" && item.category !== state.cat) return false;
    if (!ignoreKind && state.kind !== "all" && !hasCapability(item, state.kind)) return false;
    if (!ignoreAccess && state.access !== "all" && !modelsOf(item).includes(state.access)) return false;
    return true;
  }
  function filtered() {
    const result = validTools().filter(item => matchesBase(item));
    result.sort((a, b) => {
      if (state.sort === "name") return a.name.localeCompare(b.name, L() === "zh" ? "zh-CN" : "en");
      if (state.sort === "category") return categoryLabel(a.category).localeCompare(categoryLabel(b.category)) || a.name.localeCompare(b.name);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name, L() === "zh" ? "zh-CN" : "en");
    });
    return result;
  }
  function infoRow(label, value) {
    const content = localized(value);
    if (!content) return "";
    return `<div class="es-detail-row"><dt>${esc(label)}</dt><dd>${esc(content)}</dd></div>`;
  }
  function popularity(item) {
    const signals = Array.isArray(item.popularitySignals) ? item.popularitySignals : [];
    return signals.map(signal => `<p class="es-popularity-note">${esc(signal.period)} · ${esc(domainOf(item.officialUrl))} ${L() === "zh" ? `在相关类别流量排名中位列第 ${signal.rank}。` : `ranked #${signal.rank} in the category traffic ranking.`} ${ext(signal.source, L() === "zh" ? "查看 Similarweb 来源" : "View Similarweb source", "es-inline-source")}<br><span>${esc(signal.scope || t("rankNote"))}</span></p>`).join("");
  }
  function expandedContent(item) {
    const fields = [
      infoRow(t("useCases"), item.useCases), infoRow(t("strengths"), item.strengths),
      infoRow(t("limitations"), item.limitations), infoRow(t("signIn"), item.signIn),
      infoRow(t("freeTier"), item.freeTier), infoRow(t("license"), item.licenseNote),
      infoRow(t("platforms"), item.platforms)
    ].join("");
    const docs = item.documentationUrl ? ext(item.documentationUrl, t("docs"), "es-action es-action-secondary") : "";
    const code = item.githubUrl ? ext(item.githubUrl, t("sourceCode"), "es-action es-action-secondary") : "";
    return `<div class="es-expanded-copy"><p>${esc(detailsOf(item))}</p>${setupBlock(item)}<dl class="es-detail-list">${fields}</dl><div class="es-expanded-links">${docs}${code}${ext(item.officialUrl, t("visit"), "es-action es-action-primary")}</div>${popularity(item)}<p class="es-verification-line"><span>${esc(t("verification"))}: ${esc(item.lastVerifiedAt ? t("checked") : t("pending"))}</span><span>${esc(t("verified"))}: ${esc(item.lastVerifiedAt || t("noDate"))}</span></p></div>`;
  }
  function card(item) {
    const id = item.slug || item.id;
    const opened = state.expanded.has(id);
    const summary = summaryOf(item);
    const url = safeUrl(item.officialUrl);
    return `<article class="es-card" data-resource="${esc(id)}" data-category="${esc(item.category)}">
      <div class="es-card-topline"><span class="es-kind es-kind-${esc(kindOf(item))}">${esc(kindLabel(item))}</span><span class="es-cat">${esc(categoryLabel(item.category))}</span></div>
      <h2 class="es-name"><span>${esc(item.name)}</span></h2>
      <div class="es-badges" aria-label="${esc(t("access"))}">${badges(item)}</div>
      <p class="es-summary">${esc(summary)}</p>
      <div class="es-disclosure-row"><button class="es-expand" type="button" aria-expanded="${opened}" aria-controls="es-detail-${esc(id)}" data-expand="${esc(id)}">${esc(opened ? t("hideDetails") : t("details"))}<span aria-hidden="true">${opened ? "−" : "+"}</span></button></div>
      <div class="es-expanded" id="es-detail-${esc(id)}" ${opened ? "" : "hidden"}>${expandedContent(item)}</div>
      <p class="es-domain"><span aria-hidden="true">↗</span> ${esc(domainOf(url))}</p>
      <div class="es-card-controls">${ext(url, t("visit"), "es-action es-action-primary")}<a class="es-detail-route" href="${esc(detailHref(item))}">${esc(t("detailPage"))}</a></div>
    </article>`;
  }
  function allCategoryCounts(base) {
    const counts = Object.fromEntries(Object.keys(A.easysciData.categories).map(k => [k, 0]));
    base.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
    return counts;
  }
  function allKindCounts(base) {
    return { all: base.length, skill: base.filter(item => hasCapability(item, "skill")).length, mcp: base.filter(item => hasCapability(item, "mcp")).length };
  }
  function updateStats() {
    const all = validTools();
    const current = filtered();
    const baseForFacets = all.filter(item => matchesBase(item, true));
    const baseForKindFacets = all.filter(item => matchesBase(item, true, true, true));
    const countHost = root.querySelector("#esCount");
    if (countHost) countHost.innerHTML = `<span class="es-count-label">${esc(t("total"))}<b>${all.length}</b></span><span class="es-count-label">${esc(t("results"))}<b>${current.length}</b></span>`;
    root.querySelectorAll("[data-access]").forEach(button => {
      const model = button.dataset.access;
      const count = model === "all" ? baseForFacets.length : baseForFacets.filter(item => modelsOf(item).includes(model)).length;
      const countNode = button.querySelector("[data-facet-count]");
      if (countNode) countNode.textContent = count;
      button.setAttribute("aria-pressed", String(state.access === model));
    });
    const kindCounts = allKindCounts(baseForKindFacets);
    root.querySelectorAll("[data-kind]").forEach(button => {
      const kind = button.dataset.kind;
      button.setAttribute("aria-pressed", String(state.kind === kind));
      const countNode = button.querySelector("[data-facet-count]");
      if (countNode) countNode.textContent = kindCounts[kind] ?? 0;
    });
    const categoryCounts = allCategoryCounts(all.filter(item => matchesBase(item, false, true)));
    root.querySelectorAll("[data-cat]").forEach(button => {
      const cat = button.dataset.cat;
      button.setAttribute("aria-pressed", String(state.cat === cat));
      const countNode = button.querySelector("[data-facet-count]");
      if (countNode) countNode.textContent = cat === "all" ? baseForFacets.length : (categoryCounts[cat] || 0);
    });
    return current;
  }
  function list() {
    const items = updateStats();
    const grid = root.querySelector("#esGrid");
    if (!grid) return;
    const visible = items.slice(0, state.visibleLimit);
    const more = items.length > visible.length
      ? `<div class="es-load-more-wrap"><p>${esc(L() === "zh" ? `当前显示 ${visible.length} / ${items.length} 项` : `Showing ${visible.length} of ${items.length} resources`)}</p><button class="es-load-more" type="button" data-es-more>${esc(L() === "zh" ? "加载更多工具" : "Load more tools")} <span aria-hidden="true">↓</span></button></div>`
      : "";
    grid.innerHTML = items.length ? visible.map(card).join("") + more : `<div class="es-empty"><span class="es-empty-mark">∅</span><p>${esc(t("empty"))}</p><button class="es-reset-inline" id="esResetEmpty" type="button">${esc(t("clear"))}</button></div>`;
  }
  function home() {
    const categories = A.easysciData?.categories || {};
    const all = validTools();
    root.innerHTML = `<div class="es-wrap">
      <header class="es-hero"><p class="es-overline">EASYSCI / AGENT TOOLKIT</p><h1 class="es-h1">${esc(t("title"))}</h1><p class="es-lede">${esc(t("sub"))}</p><div class="es-hero-meta"><span><b>${all.length}</b> ${esc(L() === "zh" ? "项资源收录" : "resources indexed")}</span><span class="es-meta-divider" aria-hidden="true"></span><span>${esc(L() === "zh" ? "Skill · MCP · Agent 插件 · 中英双语" : "Skills · MCP · Agent Plugins · bilingual")}</span></div></header>
      <section class="es-directory" aria-label="${esc(L() === "zh" ? "工具目录筛选" : "Resource directory filters")}">
        <div class="es-search-row"><label class="es-search-label" for="esQ">${esc(L() === "zh" ? "查找工具" : "Find a tool")}</label><div class="es-search-wrap"><span aria-hidden="true" class="es-search-icon">⌕</span><input id="esQ" class="text-field es-search" type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}" value="${esc(state.q)}"><kbd>↵</kbd></div><label class="es-sort-label" for="esSort">${esc(t("sort"))}</label><select id="esSort" class="text-field es-sort" aria-label="${esc(t("sort"))}"><option value="picks">${esc(t("picks"))}</option><option value="name">${esc(t("name"))}</option><option value="category">${esc(t("categorySort"))}</option></select></div>
        <div class="es-filter-heading"><span>${esc(t("kindHeading"))}</span><button class="es-reset" id="esClear" type="button">${esc(t("clear"))} <span aria-hidden="true">↺</span></button></div>
        <div class="es-chips es-kind-chips"><button class="es-chip" type="button" data-kind="all" aria-pressed="${state.kind === "all"}">${esc(t("all"))}<span data-facet-count>${all.length}</span></button><button class="es-chip" type="button" data-kind="skill" aria-pressed="${state.kind === "skill"}">${esc(t("allSkills"))}<span data-facet-count>0</span></button><button class="es-chip" type="button" data-kind="mcp" aria-pressed="${state.kind === "mcp"}">${esc(t("allMcp"))}<span data-facet-count>0</span></button></div>
        <div class="es-filter-heading es-domain-heading"><span>${esc(t("domainHeading"))}</span></div>
        <div class="es-chips es-category-chips"><button class="es-chip" type="button" data-cat="all" aria-pressed="${state.cat === "all"}">${esc(L() === "zh" ? "全部领域" : "All domains")}<span data-facet-count>${all.length}</span></button>${Object.keys(categories).map(k => `<button class="es-chip" type="button" data-cat="${esc(k)}" aria-pressed="${state.cat === k}">${esc(categoryLabel(k))}<span data-facet-count>0</span></button>`).join("")}</div>
        <p class="es-filter-note">${esc(t("filterHint"))} ${esc(t("pluginHint"))}</p>
        <div class="es-access-row"><span class="es-access-label">${esc(t("access"))}</span><div class="es-access-chips">${[{id:"all",label:t("allAccess")},...modelOrder.map(model=>({id:model,label:modelName(model)}))].map(v=>`<button class="es-access-chip" type="button" data-access="${esc(v.id)}" aria-pressed="${state.access===v.id}">${esc(v.label)}<span data-facet-count>${all.filter(x=>v.id==="all"||modelsOf(x).includes(v.id)).length}</span></button>`).join("")}</div></div>
        <div class="es-result-bar"><p id="esCount" class="es-counts" role="status" aria-live="polite"></p><span class="es-result-hint">${esc(L() === "zh" ? "Skill 是可复用工作流；MCP 是工具连接协议与服务。安装前查看权限和数据访问范围。" : "Skills package reusable workflows; MCP connects agents to tools and services. Review permissions and data scope before setup.")}</span></div>
      </section>
      <div class="es-grid" id="esGrid"></div>
      <aside class="es-editorial-note"><span class="es-note-mark" aria-hidden="true">i</span><p>${esc(t("verifyNote"))}</p></aside>
      <footer class="es-foot"><div><span class="es-foot-brand">EASYSCI</span><p>${esc(t("footer"))}</p></div><a href="#/" class="es-home-link">${esc(L() === "zh" ? "返回 Aloop 首页" : "Back to Aloop home")} ↗</a></footer>
    </div>`;
    root.querySelector("#esSort").value = state.sort;
    root.querySelector("#esQ").addEventListener("input", event => { state.q = event.target.value; state.visibleLimit = PAGE_SIZE; list(); });
    root.querySelector("#esSort").addEventListener("change", event => { state.sort = event.target.value; state.visibleLimit = PAGE_SIZE; list(); });
    root.querySelectorAll("[data-kind]").forEach(button => button.addEventListener("click", () => { state.kind = button.dataset.kind; state.visibleLimit = PAGE_SIZE; list(); }));
    root.querySelectorAll("[data-cat]").forEach(button => button.addEventListener("click", () => { state.cat = button.dataset.cat; state.visibleLimit = PAGE_SIZE; list(); }));
    root.querySelectorAll("[data-access]").forEach(button => button.addEventListener("click", () => { state.access = button.dataset.access; state.visibleLimit = PAGE_SIZE; list(); }));
    root.querySelector("#esClear").addEventListener("click", resetFilters);
    list();
  }
  function resetFilters() {
    state.q = ""; state.kind = "all"; state.cat = "all"; state.access = "all"; state.sort = "picks"; state.expanded.clear(); state.visibleLimit = PAGE_SIZE;
    home();
  }
  function detail(slug) {
    const item = findBySlug(slug);
    if (!item) {
      root.innerHTML = `<div class="es-wrap es-not-found"><a class="es-back" href="#/easysci">${esc(t("back"))}</a><p class="es-overline">EASYSCI / 404</p><h1 class="es-h1">${esc(t("notfound"))}</h1><a class="es-action es-action-primary" href="#/easysci">${esc(t("back"))}</a></div>`;
      return;
    }
    const docs = item.documentationUrl ? ext(item.documentationUrl, t("docs"), "es-action es-action-secondary") : "";
    const code = item.githubUrl ? ext(item.githubUrl, t("sourceCode"), "es-action es-action-secondary") : "";
    const rows = [infoRow(t("useCases"), item.useCases), infoRow(t("strengths"), item.strengths), infoRow(t("limitations"), item.limitations), infoRow(t("signIn"), item.signIn), infoRow(t("freeTier"), item.freeTier), infoRow(t("license"), item.licenseNote), infoRow(t("platforms"), item.platforms)].join("");
    const related = validTools().filter(x => x.category === item.category && x.id !== item.id).slice(0, 3);
    const sources = (item.sources || [item.officialUrl]).map(raw => safeUrl(raw)).filter(Boolean);
    root.innerHTML = `<div class="es-wrap es-detail-page"><a class="es-back" href="#/easysci">${esc(t("back"))}</a><header class="es-detail-hero"><p class="es-overline">EASYSCI / ${esc(kindLabel(item))} · ${esc(categoryLabel(item.category))}</p><h1 class="es-h1"><span>${esc(item.name)}</span></h1><p class="es-summary">${esc(summaryOf(item))}</p><div class="es-badges">${badges(item)}</div><p class="es-domain">${esc(domainOf(item.officialUrl))}</p><div class="es-actions">${ext(item.officialUrl,t("visit"),"es-action es-action-primary")}${docs}${code}</div></header>
<div class="es-detail-body"><div class="es-detail-section"><p class="es-overline">${esc(L() === "zh" ? "工具说明" : "OVERVIEW")}</p><h2>${esc(L() === "zh" ? "它能帮助你完成什么" : "What it helps you do")}</h2><p>${esc(detailsOf(item))}</p>${setupBlock(item)}<dl class="es-detail-list">${rows}</dl>${popularity(item)}</div><aside class="es-verification-card"><span class="es-note-mark" aria-hidden="true">i</span><h2>${esc(t("verification"))}</h2><p>${esc(item.lastVerifiedAt ? t("checked") : t("pending"))}</p><dl><dt>${esc(t("verified"))}</dt><dd>${esc(item.lastVerifiedAt || t("noDate"))}</dd><dt>${esc(t("exact"))}</dt><dd>${esc(domainOf(item.officialUrl))}</dd></dl><p class="es-small-note">${esc(t("verifyNote"))}</p></aside></section>
      <section class="es-source-section"><p class="es-overline">02 / ${esc(t("source"))}</p><h2>${esc(t("source"))}</h2><ul>${sources.map(url=>`<li>${ext(url,url.replace(/^https:\/\//,""),"es-source-link")}</li>`).join("")}</ul></section>
      ${related.length ? `<section class="es-related-section"><p class="es-overline">03 / ${esc(t("related"))}</p><h2>${esc(t("related"))}</h2><div class="es-grid es-related-grid">${related.map(x=>`<a class="es-related-card" href="${esc(detailHref(x))}"><span class="es-cat">${esc(categoryLabel(x.category))}</span><h3>${esc(x.name)}</h3><p>${esc(summaryOf(x))}</p><span class="es-related-open">${esc(t("detailPage"))} ↗</span></a>`).join("")}</div></section>` : ""}
      <footer class="es-foot"><div><span class="es-foot-brand">EASYSCI</span><p>${esc(t("footer"))}</p></div><a href="#/easysci" class="es-home-link">${esc(t("back"))} ↗</a></footer></div>`;
  }
  root?.addEventListener("click", event => {
    if (event.target.closest("[data-es-more]")) {
      state.visibleLimit += PAGE_SIZE;
      list();
      return;
    }
    const expand = event.target.closest("[data-expand]");
    if (expand) {
      const id = expand.dataset.expand;
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      list();
      root.querySelector(`[data-expand="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest("#esResetEmpty")) resetFilters();
  });
  A.easysci = {
    show(route) {
      root.hidden = false;
      document.title = "EasySci — Aloop";
      if (route.slug) detail(route.slug); else home();
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    hide() { root.hidden = true; },
    getStats() {
      const tools = validTools();
      return { total: tools.length, validOfficialUrls: tools.length, uniqueOfficialUrls: new Set(tools.map(x=>safeUrl(x.officialUrl))).size,
        kinds: { resource: tools.filter(x=>kindOf(x)==="resource").length, skill: tools.filter(x=>hasCapability(x,"skill")).length, mcp: tools.filter(x=>hasCapability(x,"mcp")).length, plugin: tools.filter(x=>kindOf(x)==="plugin").length },
        categories: Object.fromEntries(Object.keys(A.easysciData.categories).map(k=>[k,tools.filter(x=>x.category===k).length])),
        accessModels: Object.fromEntries(modelOrder.map(m=>[m,tools.filter(x=>modelsOf(x).includes(m)).length])) };
    }
  };
  document.addEventListener("aloop:language", () => { if (root && !root.hidden) { const match = location.hash.match(/^#\/easysci\/([^/?#]+)/); if (match) detail(decodeURIComponent(match[1])); else home(); } });
})();
