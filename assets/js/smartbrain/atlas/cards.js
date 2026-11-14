/* Atlas knowledge cards. Resolution order: exact key -> region -> category -> auto stub ("Basic info").
 * Text is educational and bilingual; expert review pending (reviewed:false). Not for clinical use. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  const atlas = Aloop.atlas = Aloop.atlas || {};
  const C = (zh, en, zhDo, enDo, related, extra) => ({ name: { zh: zh, en: en }, summary: { zh: zhDo[0], en: enDo[0] }, does: { zh: zhDo.slice(1), en: enDo.slice(1) }, related: related || [], reviewed: false, ...(extra || {}) });
  const byKey = {
    "frontal-lobe": C("额叶", "Frontal lobe", ["位于大脑前部，是体积最大的脑叶。", "计划、决策与工作记忆", "随意运动控制与语言表达"], ["The largest lobe, at the front of each hemisphere.", "Planning, decision making and working memory", "Voluntary movement control and speech production"], ["precentral-gyrus", "parietal-lobe"]),
    "parietal-lobe": C("顶叶", "Parietal lobe", ["位于额叶之后、枕叶之前的上部。", "整合触觉与空间信息", "注意与身体位置感"], ["Lies behind the frontal lobe and above the occipital lobe.", "Integrates touch and spatial information", "Attention and body-position sense"], ["postcentral-gyrus", "frontal-lobe"]),
    "temporal-lobe": C("颞叶", "Temporal lobe", ["位于大脑两侧下方。", "听觉与语言理解", "记忆形成（与海马相关）"], ["Lies low on the side of each hemisphere.", "Hearing and language comprehension", "Memory formation (with the hippocampus)"], ["hippocampus", "amygdaloid-body"]),
    "occipital-lobe": C("枕叶", "Occipital lobe", ["位于大脑最后方。", "主要处理视觉信息", "包含初级视觉皮层（距状沟周围）"], ["At the back of the brain.", "Mainly processes vision", "Contains primary visual cortex (around the calcarine sulcus)"], ["calcarine-sulcus", "cuneus"]),
    "precentral-gyrus": C("中央前回", "Precentral gyrus", ["额叶后缘的脑回，位于中央沟前方。", "初级运动皮层所在", "控制对侧身体的随意运动"], ["The gyrus at the back of the frontal lobe, in front of the central sulcus.", "Home of the primary motor cortex", "Drives voluntary movement of the opposite body side"], ["postcentral-gyrus", "central-sulcus"]),
    "postcentral-gyrus": C("中央后回", "Postcentral gyrus", ["顶叶前缘的脑回，位于中央沟后方。", "初级体感皮层所在", "接收来自身体的触觉、温度与本体感觉"], ["The gyrus at the front of the parietal lobe, behind the central sulcus.", "Home of the primary somatosensory cortex", "Receives touch, temperature and proprioceptive input"], ["precentral-gyrus", "central-sulcus"]),
    "central-sulcus": C("中央沟", "Central sulcus", ["分隔额叶与顶叶的深沟。", "辨认运动与体感皮层的重要标志"], ["The deep groove separating the frontal and parietal lobes.", "A key landmark for motor and somatosensory cortex"], ["precentral-gyrus", "postcentral-gyrus"]),
    "calcarine-sulcus": C("距状沟", "Calcarine sulcus", ["枕叶内侧面的沟。", "初级视觉皮层主要沿其两侧分布"], ["A groove on the medial surface of the occipital lobe.", "Primary visual cortex lies mostly along its banks"], ["occipital-lobe", "cuneus"]),
    "hippocampus": C("海马", "Hippocampus", ["位于颞叶内侧的弯曲结构。", "新记忆的形成与巩固", "空间导航"], ["A curved structure inside the medial temporal lobe.", "Forming and consolidating new memories", "Spatial navigation"], ["amygdaloid-body", "temporal-lobe"], { approx: false }),
    "amygdaloid-body": C("杏仁核", "Amygdaloid body (amygdala)", ["位于颞叶前内侧的核团。", "情绪加工，尤其与恐惧和显著性有关", "与海马协同影响情绪记忆"], ["A nuclear complex in the anterior medial temporal lobe.", "Emotion processing, especially fear and salience", "Works with the hippocampus in emotional memory"], ["hippocampus", "hypothalamus"], { approx: true }),
    "thalamus": C("丘脑", "Thalamus", ["位于脑深部中央的成对灰质团。", "多数感觉信息进入皮层前的中继站", "参与觉醒与注意调节"], ["A paired grey-matter mass deep in the centre of the brain.", "Relay for most sensory information heading to cortex", "Helps regulate arousal and attention"], ["hypothalamus", "internal-capsule"], { approx: true }),
    "hypothalamus": C("下丘脑", "Hypothalamus", ["位于丘脑下方的小结构。", "调节体温、饥渴、睡眠节律", "通过垂体控制激素分泌"], ["A small structure beneath the thalamus.", "Regulates temperature, hunger, thirst and sleep rhythms", "Controls hormone release via the pituitary"], ["thalamus"], { approx: true }),
    "caudate-nucleus": C("尾状核", "Caudate nucleus", ["基底节的组成部分，呈弧形环绕侧脑室。", "参与运动规划、学习与奖赏"], ["Part of the basal ganglia, arching around the lateral ventricle.", "Involved in motor planning, learning and reward"], ["putamen"]),
    "putamen": C("壳核", "Putamen", ["基底节的组成部分，位于脑岛深面。", "参与运动调节与习惯学习"], ["Part of the basal ganglia, deep to the insula.", "Involved in movement regulation and habit learning"], ["caudate-nucleus"]),
    "corpus-callosum": C("胼胝体", "Corpus callosum", ["连接左右半球的最大纤维束。", "含约两亿根轴突", "使两半球快速交换信息"], ["The largest fibre bundle joining the two hemispheres.", "Contains roughly two hundred million axons", "Lets both sides exchange information quickly"], []),
    "cerebellum": C("小脑", "Cerebellum", ["位于枕叶下方、脑干后方。", "协调运动与平衡", "参与运动学习与部分认知功能"], ["Sits below the occipital lobe, behind the brainstem.", "Coordinates movement and balance", "Contributes to motor learning and some cognition"], ["pons"]),
    "pons": C("脑桥", "Pons", ["脑干的中间部分。", "连接大脑与小脑的通路", "参与呼吸与睡眠调节"], ["The middle part of the brainstem.", "Carries pathways linking cerebrum and cerebellum", "Helps regulate breathing and sleep"], ["cerebellum", "medulla-oblongata"]),
    "medulla-oblongata": C("延髓", "Medulla oblongata", ["脑干最下部，连接脊髓。", "控制心跳、呼吸等生命功能"], ["The lowest part of the brainstem, continuous with the spinal cord.", "Controls vital functions such as heartbeat and breathing"], ["pons"]),
  };
  const byCategory = {
    cortex: { zh: "大脑皮层的一部分。皮层折叠成脑回与脑沟，负责感知、运动、语言与思维。", en: "Part of the cerebral cortex, folded into gyri and sulci, supporting perception, movement, language and thought." },
    tracts: { zh: "白质纤维束，连接不同脑区。位置由开放图谱配准得到，属近似呈现。", en: "A white-matter pathway linking brain regions. Positions are registered from open atlases and are approximate." },
    arteries: { zh: "供应大脑血液的动脉（Willis 环及其分支）。", en: "An artery supplying the brain (circle of Willis and branches)." },
    cranial_nerves: { zh: "十二对脑神经之一或其分支。", en: "One of the twelve cranial nerves or a branch of one." },
    ventricles: { zh: "脑室系统的一部分，充满脑脊液。", en: "Part of the ventricular system, filled with cerebrospinal fluid." },
  };
  const catNames = {
    cortex: { zh: "大脑皮层", en: "Cortex" }, tracts: { zh: "白质纤维束", en: "White-matter tracts" }, arteries: { zh: "动脉", en: "Arteries" },
    cranial_nerves: { zh: "脑神经", en: "Cranial nerves" }, ventricles: { zh: "脑室", en: "Ventricles" }, brainstem: { zh: "脑干", en: "Brainstem" },
    cerebellum: { zh: "小脑", en: "Cerebellum" }, deep_grey: { zh: "深部灰质", en: "Deep grey matter" }, diencephalon: { zh: "间脑", en: "Diencephalon" },
    veins: { zh: "静脉与静脉窦", en: "Veins & sinuses" }, meninges: { zh: "脑膜", en: "Meninges" },
  };
  const humanize = s => String(s || "other").replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase());
  const lang = () => Aloop.i18n?.lang === "zh" ? "zh" : "en";
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const t = k => Aloop.i18n?.t(k) ?? k;

  function resolve(item) {
    const exact = byKey[item.key];
    if (exact) return { ...exact, level: "curated" };
    const cat = byCategory[item.cat];
    return { name: null, summary: cat || null, does: null, related: [], level: cat ? "category" : "stub" };
  }
  function nameOf(item, l) { const c = byKey[item.key]; return c ? c.name[l || lang()] : item.label; }
  function catName(cat, l) { return (catNames[cat] || { zh: humanize(cat), en: humanize(cat) })[l || lang()]; }

  function html(item, data) {
    const l = lang(), card = resolve(item), d = atlas.data;
    const title = card.name ? card.name[l] : item.label;
    const sub = card.name && l === "zh" ? item.label : (card.name ? "" : "");
    const side = item.side && item.side !== "median" ? `<span class="atlas-badge">${esc(t("atlas.side." + item.side))}</span>` : "";
    const crumbs = (item.path || []).map((p, i) => `<button type="button" class="atlas-crumb" data-act="crumb" data-q="${esc(p)}">${esc(p)}</button>`).join('<span aria-hidden="true"> › </span>');
    const summary = card.summary ? (card.summary[l] || card.summary) : "";
    const does = card.does && card.does[l]?.length ? `<h4>${esc(t("atlas.does"))}</h4><ul>${card.does[l].map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    const rel = (card.related || []).map(k => d.byKey.get(k)).filter(Boolean);
    const related = rel.length ? `<h4>${esc(t("atlas.related"))}</h4><p class="atlas-chips">${rel.map(r => `<button type="button" class="atlas-chip" data-act="select" data-id="${esc(r.id)}">${esc(nameOf(r))}</button>`).join("")}</p>` : "";
    const approx = card.approx || item.cat === "tracts" ? `<p class="atlas-note">${esc(t("atlas.note.approx"))}</p>` : "";
    const basic = card.level !== "curated" ? `<span class="atlas-badge is-basic">${esc(t("atlas.basic"))}</span>` : "";
    const stubText = !summary ? `<p>${esc(t("atlas.stubBody"))}</p>` : `<p class="atlas-summary">${esc(summary)}</p>`;
    return `<article class="atlas-card" aria-labelledby="atlasCardTitle">
      <header><span class="atlas-dot" style="background:${d.colorOf(item.cat)}"></span><h3 id="atlasCardTitle">${esc(title)}</h3>${side}${basic}<button type="button" class="atlas-x" data-act="close" aria-label="${esc(t("atlas.close"))}">×</button></header>
      ${sub ? `<p class="atlas-sub">${esc(sub)}</p>` : ""}
      <p class="atlas-meta">${esc(catName(item.cat))}</p>
      ${crumbs ? `<nav class="atlas-crumbs" aria-label="TA2">${crumbs}</nav>` : ""}
      ${stubText}${does}${related}${approx}
      <div class="atlas-actions"><button type="button" data-act="focus">${esc(t("atlas.focus"))}</button><button type="button" data-act="isolate" aria-pressed="${data.isolate}">${esc(t(data.isolate ? "atlas.unisolate" : "atlas.isolate"))}</button><button type="button" data-act="listen">${esc(t("atlas.listen"))}</button><button type="button" data-act="copy">${esc(t("atlas.copy"))}</button></div>
    </article>`;
  }
  function narration(item) {
    const l = lang(), c = resolve(item);
    const parts = [c.name ? c.name[l] : item.label];
    if (c.summary) parts.push(c.summary[l] || c.summary);
    if (c.does?.[l]) parts.push(...c.does[l]);
    return parts;
  }
  atlas.cards = { byKey, byCategory, resolve, nameOf, catName, html, narration };
})();
