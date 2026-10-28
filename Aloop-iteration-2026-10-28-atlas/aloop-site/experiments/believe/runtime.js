/* beLieve experiment runtime. Data and evidence remain pilot drafts pending independent review. */
const Aloop = window.Aloop = window.Aloop || {};
let rootNode = null;
let runtimeContext = null;
let isMounted = false;
/* Bilingual pairs are stored as [en, zh]. pick() resolves the active language. */
const TRAIN = [
  { id: "t1", v: 1, x: ["Bananas are botanically classified as berries.", "从植物学分类看,香蕉属于浆果。"], e: [[["Botany reference", "植物学参考资料"], ["A berry is a fleshy fruit from one ovary with seeds embedded in the flesh. Bananas meet this definition.", "浆果是由单个子房发育而成、种子嵌在果肉中的肉质果实。香蕉符合这一定义。"]], [["University plant-science page", "某大学植物科学页面"], ["Bananas are berries; strawberries are not.", "香蕉是浆果;草莓反而不是。"]]] },
  { id: "t2", v: 0, x: ["Bulls charge because the color red enrages them.", "公牛发起冲撞是因为红色会激怒它们。"], e: [[["Veterinary science review", "兽医学综述"], ["Cattle are red-green colour blind. They react to the cape's movement, not its colour.", "牛是红绿色盲,它们对斗篷的移动作出反应,而不是颜色。"]], [["Anonymous trivia blog", "匿名冷知识博客"], ["Everyone knows bulls hate red. No evidence is given.", "人人都知道公牛讨厌红色。文中未给出任何证据。"]]] },
  { id: "t3", v: 1, x: ["Sharks were already living on Earth before trees existed.", "在树木出现之前,鲨鱼就已经生活在地球上了。"], e: [[["Palaeontology museum page", "古生物博物馆页面"], ["Shark ancestors date back about 450 million years.", "鲨鱼的祖先可追溯至约 4.5 亿年前。"]], [["Geology survey summary", "地质调查摘要"], ["The first trees appeared roughly 350-385 million years ago.", "最早的树木大约出现在 3.5 至 3.85 亿年前。"]]] }
];
const TEST = [
  { id: "s1", v: 1, h: ["Octopuses have three hearts: two pump blood through the gills and one circulates it to the rest of the body.", "章鱼有三颗心脏:两颗负责将血液泵入鳃,另一颗负责全身循环。"], a: ["An octopus has three hearts. Two send blood to the gills, while the third supplies the rest of the body.", "章鱼有三颗心脏。两颗向鳃输送血液,第三颗供应身体其他部分。"], e: [[["Marine biology encyclopedia", "海洋生物学百科"], ["Octopuses have two branchial hearts serving the gills and one systemic heart.", "章鱼有两颗服务鳃的鳃心,以及一颗体心脏。"]], [["Aquarium fact sheet", "水族馆资料页"], ["Three hearts: two for the gills, one for the organs.", "三颗心脏:两颗供鳃,一颗供其他器官。"]]] },
  { id: "s2", v: 1, h: ["Venus spins in the opposite direction to most planets, so the Sun rises in the west there.", "金星的自转方向与大多数行星相反,因此那里的太阳从西边升起。"], a: ["Venus rotates retrograde, opposite to most planets, which means the Sun appears to rise in the west.", "金星为逆行自转,与大多数行星相反,这意味着太阳看起来从西边升起。"], e: [[["Space agency planet profile", "航天机构行星档案"], ["Venus has retrograde rotation; the Sun rises in the west.", "金星逆行自转;太阳从西边升起。"]], [["Astronomy textbook note", "天文学教材注释"], ["Venus rotates opposite to most planets in the solar system.", "金星的自转方向与太阳系大多数行星相反。"]]] },
  { id: "s3", v: 0, h: ["Habitual knuckle cracking leads to arthritis in the fingers over time.", "长期习惯性地掰手指关节会导致手指关节炎。"], a: ["Regularly cracking your knuckles is known to cause arthritis in the hands.", "众所周知,经常掰手指关节会导致手部关节炎。"], e: [[["Rheumatology society FAQ", "风湿病学会常见问题"], ["Studies found no link between knuckle cracking and osteoarthritis.", "研究未发现掰指关节与骨关节炎之间存在关联。"]], [["Clinical study review", "临床研究综述"], ["Habitual crackers showed no higher rates of hand arthritis.", "习惯性掰指者手部关节炎发病率并未更高。"]]] },
  { id: "s4", v: 0, h: ["Controlled trials show that sugar makes children hyperactive.", "对照试验表明糖会使儿童多动。"], a: ["Research has proven that sugar causes hyperactivity in children.", "研究已经证明糖会导致儿童多动。"], e: [[["Systematic review of double-blind trials", "双盲试验系统综述"], ["Sugar did not affect children's behaviour or cognition.", "糖并未影响儿童的行为或认知。"]], [["Paediatric association guidance", "儿科协会指南"], ["Parent expectations, not sugar, drive perceived hyperactivity.", "被感知到的多动源于家长的预期,而非糖。"]]] },
  { id: "s5", v: 1, h: ["Lightning often strikes the same place repeatedly; the Empire State Building is hit about twenty times a year.", "闪电经常会重复击中同一地点;帝国大厦每年约被击中二十次。"], a: ["Contrary to the saying, lightning frequently strikes the same location more than once. The Empire State Building is struck 20-25 times annually.", "与俗语相反,闪电经常多次击中同一位置。帝国大厦每年被击中 20 至 25 次。"], e: [[["Weather service safety page", "气象部门安全页面"], ["Lightning often strikes the same place, especially tall isolated objects.", "闪电经常击中同一地点,尤其是高大孤立的物体。"]], [["Science museum article", "科技馆文章"], ["The Empire State Building is hit about 20 to 25 times a year.", "帝国大厦每年约被闪电击中 20 至 25 次。"]]] },
  { id: "s6", v: 1, h: ["The Great Barrier Reef has suffered several mass coral-bleaching events since 2016.", "自 2016 年以来,大堡礁已经历了多次大规模珊瑚白化事件。"], a: ["Since 2016, Australia's Great Barrier Reef has experienced multiple mass bleaching events.", "自 2016 年以来,澳大利亚大堡礁发生了多次大规模白化事件。"], e: [[["Reef marine park authority", "珊瑚礁海洋公园管理局"], ["Mass bleaching was recorded in 2016, 2017, 2020 and 2022.", "2016、2017、2020 和 2022 年均记录到大规模白化。"]], [["Peer-reviewed climate study", "经同行评审的气候研究"], ["Repeated marine heatwaves caused widespread bleaching across the reef.", "反复的海洋热浪造成整个珊瑚礁大范围白化。"]]] },
  { id: "s7", v: 0, h: ["Goldfish only remember things for about three seconds.", "金鱼的记忆只有大约三秒。"], a: ["A goldfish's memory lasts just three seconds, which is why a bowl never bores them.", "金鱼的记忆只有三秒,所以鱼缸永远不会让它们感到无聊。"], e: [[["Fish-behaviour study", "鱼类行为研究"], ["Goldfish remembered feeding cues for weeks or months.", "金鱼能记住喂食线索长达数周甚至数月。"]], [["Aquaculture university page", "某大学水产养殖页面"], ["Experiments show goldfish retain learned tasks for months.", "实验表明金鱼数月后仍保留学会的任务。"]]] },
  { id: "s8", v: 0, h: ["Humans only use about ten percent of their brains.", "人类只使用了大脑的大约百分之十。"], a: ["Most people use just 10% of their brain capacity; the rest sits idle.", "大多数人只使用了大脑容量的 10%,其余部分处于闲置状态。"], e: [[["Neuroscience institute explainer", "神经科学研究所科普"], ["Imaging shows activity across virtually all brain regions.", "成像显示几乎所有脑区都存在活动。"]], [["Neurology textbook", "神经病学教材"], ["Damage to almost any brain area causes some deficit, contradicting the 10% idea.", "几乎任何脑区受损都会造成某种功能缺损,这与 10% 的说法相矛盾。"]]] }
];
const PRINCIPLES = [
  ["Leave the page. Ask what independent sources say about the claim.", "离开当前页面,去查独立来源对这条主张的说法。"],
  ["Compare sources. Weight those that give evidence over those that only assert.", "比较来源:看重给出证据的,而非只下断言的。"],
  ["If evidence is thin or conflicting, say it is insufficient instead of guessing.", "如果证据薄弱或相互矛盾,就判断证据不足,而不是靠猜。"]
];

const STR = {
  zh: {
    navMethod: "研究方法", navProtocol: "实验流程", navStatus: "研究状态", footTag: "研究原型 / 01",
    step0: "知情同意", step1: "训练", step2: "测试", step3: "结果说明",
    stepSub0: "了解你的作答将如何被使用。", stepSub1: "在正式测试前完成短活动。", stepSub2: "判断八条新主张。", stepSub3: "查看哪些主张为假,以及原因。",
    stepOf: "第 {n} 步,共 4 步",
    heroEb: "横向阅读 / 实地研究 01",
    heroL1: "核查主张，", heroL2: "而不只是", heroL3: "盯着页面",
    heroLede: "一个关于人们如何判断网络信息的研究原型:给主张打分、查看证据、观察信心如何变化。",
    beginCta: "开始实验 ↗", beginMeta: "约 15 分钟 / 本地原型",
    resumeCta: "继续已保存的会话 ↗", resumeMeta: "已保存在本设备",
    resumeEb: "已保存的会话", resumeTitle: "从中断处继续。", resumeText: "此浏览器中保存了一个未完成或已完成的会话,恢复后将回到最近保存的步骤。", newSession: "开始新会话",
    newSessionConfirm: "要开始新会话吗?此前的会话日志仍保留在本浏览器中,但其保存的进度状态将被替换。",
    condEb: "三个实验入口", condH2: "三条路径,同一个问题。", condLede: "本原型包含三种实验条件。选择其一进入对应的训练阶段;正式研究中条件将由服务端随机分配。",
    entASub: "实验条件 A", entA: "横向阅读游戏", entADesc: "判断一条主张,展开给定证据,然后修正你的判断。",
    entBSub: "实验条件 B", entB: "引导教程", entBDesc: "逐步阅读同样的横向阅读原则与示例。",
    entCSub: "实验条件 C", entC: "中性任务", entCDesc: "找出颜色不同的方块,与信息核查无关。",
    entStart: "开始 ↗",
    condNote: "三个入口仅供本地质量检查。客户端分组与这份草稿题库不适合正式随机试验。",
    methodEb: "01 / 研究方法", methodH2: "跳出第一个答案。", methodLede: "横向阅读意味着离开当前页面,看看其他来源对同一主张怎么说。本原型探索结构化的证据核查能否改变人们的信心与转发决定。",
    f1h: "离开页面。", f1p: "不要只依赖主张所在页面的措辞、设计或表面权威。",
    f2h: "比较来源。", f2p: "比较相互独立的来源,优先采信给出证据的一方,而非只下断言的一方。",
    f3h: "校准信心。", f3p: "当证据薄弱或不一致时,保留不确定性,而不是靠猜。",
    protoEb: "02 / 实验流程", protoH2: "四个阶段,十五分钟。", protoLede: "当前浏览器试测约需 15 分钟,用于在正式研究之前验证流程与交互设计。",
    p1h: "知情同意", p1p: "了解将存储哪些内容,同意后再开始。",
    p2h: "训练", p2p: "完成三种实验条件之一。",
    p3h: "测试", p3p: "给八条新主张打分、查看证据,并报告是否会转发。",
    p4h: "结果说明", p4p: "查看纠错说明,并导出本地事件日志。",
    statusEb: "03 / 研究状态", statusH2: "这是原型,不是正式试验。", statusLede: "本原型只在当前浏览器中存储数据。题库与证据片段仍待专家审核,请勿用于正式招募或验证性数据收集。",
    statusBottom: "未配置服务器上传。浏览器存储可能被清除,不能作为备份。",
    consEb: "研究原型说明", consP1: "你将练习判断简短的事实性主张,然后给新主张打分,全程约 15 分钟。",
    consP2: "你可以随时关闭本页面。本原型将匿名会话标识与你的作答保存在本浏览器的本地存储中,不会发送到研究服务器。浏览器数据可能被清除,本原型尚不提供远程备份。",
    consP3: "研究状态:题库与证据片段尚未完成专家审核,不能用于正式数据收集。",
    consBtn: "我已知情并同意,开始",
    lessonOf: "第 {n} 课,共 {m} 课", workedExample: "示例:“{x}”", contBtn: "继续",
    roundOf: "第 {n} 轮,共 3 轮", neutralTask: "点选颜色不同的那一块。", tileLabel: "方块 {n}",
    practiceOf: "练习 {n}/{m}", claimOf: "主张 {n}/{m}",
    beforeCheck: "在查看任何信息之前:这条主张为真的可能性有多大?",
    lockBtn: "锁定首次判断", falseLab: "假", trueLab: "真",
    checkBeyond: "核查主张之外的信息", finalJudge: "最终判断:它为真的可能性有多大?",
    insLab: "现有证据不足以作出判断", shareQ: "你会转发这条主张吗?", shareYes: "会转发", shareNo: "不转发",
    submitBtn: "提交判断", needOpenMsg: "请先展开至少一条来源,然后选择是否转发该主张。", chooseMsg: "请选择是否转发该主张。",
    fbEb: "反馈", yourJudgment: "你的判断:初次 {a}%,核查后 {b}%。",
    supported: "有证据支持。", notSupported: "无证据支持。",
    thanks: "谢谢参与。", corrEb: "纠错说明", corrIntro: "以下主张为假:",
    sumEb: "试测摘要 · 非试验结果", sumNote: "仅凭八道测试题,这些描述性数值并不稳定,请勿用作验证性证据。",
    rowValid: "有效测试作答", rowD: "d′(敏感度)", rowC: "c(判断标准)", rowBrier: "Brier 分数", rowArm: "条件 / 措辞翻转",
    sumSmall: "d′ 与 c 使用 log-linear 校正,并将高于 50% 的判断记为“真”。验证性分析必须遵循预注册分析方案,并考虑题目层面的变异。",
    logSummary: "事件日志 (JSON)", copyBtn: "复制数据", dlBtn: "下载 JSON",
    copiedMsg: "数据已复制到剪贴板。", copyBlockMsg: "自动复制被拦截,请手动选择上方 JSON 并复制。", dlMsg: "浏览器已开始下载 JSON。",
    logNote: "日志仅保留在本浏览器中,未配置服务器上传。",
    storageWarn: "警告:此浏览器无法在本地保存会话,请在离开前导出数据。"
  },
  en: {
    navMethod: "The method", navProtocol: "The protocol", navStatus: "Study status", footTag: "RESEARCH PROTOTYPE / 01",
    step0: "Consent", step1: "Training", step2: "Test", step3: "Debrief",
    stepSub0: "Read how your answers are used.", stepSub1: "Finish the short activity before the test.", stepSub2: "Judge eight new claims.", stepSub3: "See which claims were false, and why.",
    stepOf: "Step {n} of 4",
    heroEb: "Lateral reading / field study 01",
    heroL1: "Check the claim,", heroL2: "not just", heroL3: "the page",
    heroLede: "A research prototype about how people judge information online. Rate a claim, inspect the evidence, and see how your confidence changes.",
    beginCta: "Begin pilot session ↗", beginMeta: "Approx. 15 minutes / local prototype",
    resumeCta: "Resume saved session ↗", resumeMeta: "Saved on this device",
    resumeEb: "Saved pilot session", resumeTitle: "Continue where you left off.", resumeText: "An unfinished or completed session is saved in this browser. Resume it to return to the last saved step.", newSession: "Start a new session",
    newSessionConfirm: "Start a new session? The previous session log will remain in this browser, but its saved screen state will be replaced.",
    condEb: "Three experiment entrances", condH2: "Three paths, one question.", condLede: "This prototype ships three pilot conditions. Pick one to enter its training stage; in a formal study, conditions would be assigned server-side.",
    entASub: "Pilot condition A", entA: "Lateral-reading game", entADesc: "Judge a claim, open the provided evidence snippets, then revise your answer.",
    entBSub: "Pilot condition B", entB: "Guided tutorial", entBDesc: "Read the same principles and worked examples, step by step.",
    entCSub: "Pilot condition C", entC: "Neutral game", entCDesc: "Spot the odd shade. Unrelated to checking claims.",
    entStart: "Start ↗",
    condNote: "The three entrances are for local quality assurance only. Client-side assignment and this draft item bank are not suitable for formal randomised research.",
    methodEb: "01 / The method", methodH2: "Look beyond the first answer.", methodLede: "Lateral reading means leaving a page to learn what other sources say about the same claim. This prototype explores whether structured evidence checking can change confidence and sharing decisions.",
    f1h: "Leave the page.", f1p: "Do not rely only on the wording, design, or apparent authority of the page that made the claim.",
    f2h: "Compare sources.", f2p: "Compare independent sources and prioritize evidence over unsupported assertions.",
    f3h: "Calibrate confidence.", f3p: "When evidence is thin or inconsistent, preserve uncertainty instead of guessing.",
    protoEb: "02 / The protocol", protoH2: "Four stages. One short session.", protoLede: "The current browser-based pilot takes about 15 minutes. It is intended to validate the flow and interaction design before any formal study.",
    p1h: "Consent", p1p: "Read what is stored and agree before starting.",
    p2h: "Training", p2p: "Complete one of three pilot conditions.",
    p3h: "Test", p3p: "Rate eight new claims, inspect evidence, and report whether you would share them.",
    p4h: "Debrief", p4p: "Review corrections and export the local event log.",
    statusEb: "03 / Study status", statusH2: "A pilot, not a live trial.", statusLede: "This prototype stores data only in the current browser. The item bank and evidence snippets still require expert review. Do not use this build for participant recruitment or confirmatory data collection.",
    statusBottom: "No server upload is configured. Browser storage can be cleared and is not a backup.",
    consEb: "Research study prototype", consP1: "You will practise judging short factual claims, then rate new ones. It takes about 15 minutes.",
    consP2: "You may close this page at any time. This prototype stores an anonymous session identifier and your responses in this browser's local storage; it does not send them to a research server. Browser data can be cleared, and this prototype does not yet provide remote backup.",
    consP3: "Research status: the item bank and evidence snippets have not completed expert review and are not ready for live data collection.",
    consBtn: "I consent, begin",
    lessonOf: "Lesson {n} of {m}", workedExample: "Worked example: “{x}”", contBtn: "Continue",
    roundOf: "Round {n} of 3", neutralTask: "Tap the tile with a different shade.", tileLabel: "Tile {n}",
    practiceOf: "Practice {n} of {m}", claimOf: "Claim {n} of {m}",
    beforeCheck: "Before checking anything: how likely is this claim to be true?",
    lockBtn: "Lock first judgment", falseLab: "False", trueLab: "True",
    checkBeyond: "Check beyond the claim", finalJudge: "Final judgment: how likely is it to be true?",
    insLab: "The available evidence is insufficient to decide", shareQ: "Would you forward this claim?", shareYes: "Forward", shareNo: "Do not forward",
    submitBtn: "Submit judgment", needOpenMsg: "Open at least one source, then choose whether to forward the claim.", chooseMsg: "Choose whether to forward the claim.",
    fbEb: "Feedback", yourJudgment: "Your judgment: {a}% initially, {b}% after checking.",
    supported: "Supported by evidence.", notSupported: "Not supported by evidence.",
    thanks: "Thank you.", corrEb: "Corrections", corrIntro: "These claims were false:",
    sumEb: "Pilot summary · not a trial result", sumNote: "These descriptive values are unstable with only eight test items. Do not use them as confirmatory evidence.",
    rowValid: "Valid test responses", rowD: "d′ (sensitivity)", rowC: "c (criterion)", rowBrier: "Brier score", rowArm: "Arm / wording flip",
    sumSmall: "d′ and c use a log-linear correction and classify responses above 50% as “true”. Confirmatory analysis must follow a preregistered analysis plan and account for item-level variation.",
    logSummary: "Event log (JSON)", copyBtn: "Copy data", dlBtn: "Download JSON",
    copiedMsg: "Data copied to clipboard.", copyBlockMsg: "Automatic copy was blocked. Select the JSON above and copy it manually.", dlMsg: "JSON download requested by the browser.",
    logNote: "The log remains in this browser. No server upload has been configured.",
    storageWarn: "Warning: this browser could not save the session locally. Export your data before leaving."
  }
};
const LANG_KEY = "aloop_lang_v1";
let lang = "zh";
try {
  const storedLanguage = localStorage.getItem(LANG_KEY);
  const legacyLanguage = storedLanguage === null ? localStorage.getItem("llab_lang_v1") : null;
  lang = (storedLanguage || legacyLanguage) === "en" ? "en" : "zh";
  if (storedLanguage === null && legacyLanguage) localStorage.setItem(LANG_KEY, legacyLanguage);
} catch (_) { lang = "zh"; }
function t(key) { return (STR[lang] && STR[lang][key]) || STR.en[key] || key; }
function fill(template, values) { return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k])); }
function pick(pair) { return pair[lang === "zh" ? 1 : 0]; }
function stepNames() { return [t("step0"), t("step1"), t("step2"), t("step3")]; }
function stepSubs() { return [t("stepSub0"), t("stepSub1"), t("stepSub2"), t("stepSub3")]; }

const ACTIVE_KEY = "aloop_believe_session_v1";
const LEGACY_ACTIVE_KEY = "llab_active_session_v2";
const $ = selector => rootNode ? rootNode.querySelector(selector) : null;
const view = () => rootNode;

function newId() {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return "p" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  } catch (_) {
    return "p" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
function blankSession() {
  return { schema: 2, pid: "", arm: "", flip: 0, log: [], res: [], Q: [], phase: "home", trainIndex: 0, testIndex: 0, neutralRound: 1, neutralChallenge: null, currentTrial: null, lastResult: null, persistenceWarning: false };
}
function loadSession() {
  try {
    let raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_ACTIVE_KEY);
      if (raw) localStorage.setItem(ACTIVE_KEY, raw);
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.schema !== 2 || !Array.isArray(data.log) || !Array.isArray(data.res)) return null;
    data.Q = Array.isArray(data.Q) ? data.Q : [];
    return data;
  } catch (_) {
    return null;
  }
}
const savedSession = loadSession();
const S = savedSession || blankSession();

function persistSession() {
  if (!S.pid) return;
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(S));
    S.persistenceWarning = false;
  } catch (_) {
    S.persistenceWarning = true;
    showPersistenceWarning();
  }
}
function persistLog() {
  if (!S.pid) return;
  try {
    // Keep a separate log per participant/session instead of overwriting one shared log key.
    localStorage.setItem("aloop_believe_log_v1_" + S.pid, JSON.stringify(S.log));
  } catch (_) {
    S.persistenceWarning = true;
    showPersistenceWarning();
  }
}
function showPersistenceWarning() {
  if (Aloop.setStorageWarning) Aloop.setStorageWarning(t("storageWarn"));
}
function saveAll() {
  persistLog();
  persistSession();
  if (!S.persistenceWarning && Aloop.setStorageWarning) Aloop.setStorageWarning("");
}
function logEvent(type, data = {}) {
  S.log.push({ ...data, pid: S.pid, arm: S.arm, site: "aloop", experiment_id: "believe", app_version: "0.1.0", t: Date.now(), type });
  saveAll();
}
function setPhase(phase) {
  S.phase = phase;
  persistSession();
}
function shuffle(items) {
  // Fisher-Yates gives an unbiased permutation; sort(() => Math.random() - .5) does not.
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function heading(step) {
  const names = stepNames();
  if (Aloop.updateExperimentProgress) Aloop.updateExperimentProgress(step, names[step] || "", step + 1, names.length);
  window.scrollTo({ top: 0, behavior: "auto" });
}
function slider(container, initialValue, onChange) {
  const initial = Math.max(0, Math.min(100, Number(initialValue) || 0));
  container.innerHTML = `<input type="range" min="0" max="100" step="1" value="${initial}" aria-label="Probability the claim is true"><div class="row"><span>${t("falseLab")}</span><b>${initial}%</b><span>${t("trueLab")}</span></div>`;
  const range = container.querySelector("input");
  const label = container.querySelector("b");
  range.addEventListener("input", () => {
    label.textContent = `${range.value}%`;
    if (onChange) onChange(Number(range.value));
  });
  return () => Number(range.value);
}
function evidenceHTML(item) {
  return `<p class="${item.v ? "ok" : "no"}">${item.v ? t("supported") : t("notSupported")}</p>` +
    item.e.map(source => `<p><b>${pick(source[0])}</b><br><span class="mut">${pick(source[1])}</span></p>`).join("");
}
function findItem(id) {
  return TRAIN.concat(TEST).find(item => item.id === id);
}

function startNewSession(arm) {
  if (!["A", "B", "C"].includes(arm)) arm = "A";
  Object.assign(S, blankSession(), { pid: newId(), arm, flip: Math.random() < 0.5 ? 1 : 0, phase: "consent" });
  persistSession();
  consent();
}
function home() {
  if (runtimeContext && typeof runtimeContext.exit === "function") runtimeContext.exit();
}
function consent() {
  heading(0);
  setPhase("consent");
  view().innerHTML = `<h1 class="consent-title"><span>${t("heroL1")}</span><span>${t("heroL2")}</span><span>${t("heroL3")}</span></h1><section class="card"><p class="eb">${t("consEb")}</p><p>${t("consP1")}</p><p>${t("consP2")}</p><p><b>${t("consP3")}</b></p><button class="btn" id="go"><span>${t("consBtn")}</span></button></section>`;
  $("#go").addEventListener("click", () => {
    // Commit the next stage before logging so an immediate refresh cannot return to the consent screen.
    S.phase = "training";
    S.trainIndex = 0;
    logEvent("consent", { consented: true });
    logEvent("assign", { flip: S.flip, view: document.documentElement.dataset.view || "unknown", os: document.documentElement.dataset.os || "unknown", assignment_method: runtimeContext && runtimeContext.qa ? "client_qa_pilot" : "client_default_pilot" });
    train(0);
  });
}

function train(index) {
  S.trainIndex = index;
  heading(1);
  if (S.arm === "C") return neutral(1);
  if (index >= TRAIN.length) return test(0);
  const item = TRAIN[index];
  if (S.arm === "A") {
    return trial(item, pick(item.x), { label: fill(t("practiceOf"), { n: index + 1, m: TRAIN.length }), need: 1, feedback: true, recordResult: false, variant: "training", flow: "train", nextIndex: index + 1 });
  }
  setPhase("lesson");
  view().innerHTML = `<section class="card"><p class="eb">${fill(t("lessonOf"), { n: index + 1, m: TRAIN.length })}</p><p class="claim">${pick(PRINCIPLES[index])}</p><p class="mut">${fill(t("workedExample"), { x: pick(item.x) })}</p>${evidenceHTML(item)}<button class="btn" id="next"><span>${t("contBtn")}</span></button></section>`;
  $("#next").addEventListener("click", () => {
    S.trainIndex = index + 1;
    S.phase = "training";
    logEvent("lesson", { item: item.id, lesson_index: index });
    train(index + 1);
  });
}

function neutral(round) {
  if (round > 3) return test(0);
  S.neutralRound = round;
  setPhase("neutral");
  heading(1);
  if (!S.neutralChallenge || S.neutralChallenge.round !== round) {
    S.neutralChallenge = { round, hue: Math.floor(Math.random() * 360), odd: Math.floor(Math.random() * 16) };
    persistSession();
  }
  const { hue, odd } = S.neutralChallenge;
  view().innerHTML = `<section class="card"><p class="eb">${fill(t("roundOf"), { n: round })}</p><p class="claim">${t("neutralTask")}</p><div class="grid">${Array.from({ length: 16 }, (_, i) => `<button class="tile" aria-label="${fill(t("tileLabel"), { n: i + 1 })}" data-k="${i}" style="background:hsl(${hue} 60% ${i === odd ? 57 : 50}%)"></button>`).join("")}</div></section>`;
  rootNode.querySelectorAll(".tile").forEach(button => button.addEventListener("click", () => {
    const selected = Number(button.dataset.k);
    S.neutralRound = round + 1;
    S.neutralChallenge = null;
    S.phase = "neutral";
    logEvent("neutral", { round, hit: selected === odd, selected_tile: selected });
    neutral(round + 1);
  }));
}

function trial(item, text, options) {
  S.currentTrial = {
    item,
    text,
    label: options.label,
    need: options.need,
    feedback: options.feedback,
    recordResult: options.recordResult,
    variant: options.variant,
    flow: options.flow,
    nextIndex: options.nextIndex,
    opened: [],
    expanded: [],
    initial: null,
    finalNow: null,
    insufficient: false,
    share: null,
    elapsedMs: 0,
    activeSince: Date.now(),
    submitted: false
  };
  setPhase("trial_initial");
  renderTrialInitial();
}
function currentTrialElapsed(context) {
  return Math.max(0, (context.elapsedMs || 0) + (context.activeSince ? Date.now() - context.activeSince : 0));
}
function renderTrialInitial() {
  const context = S.currentTrial;
  if (!context) return resumeSession();
  if (!context.activeSince) context.activeSince = Date.now();
  setPhase("trial_initial");
  heading(context.flow === "test" ? 2 : 1);
  view().innerHTML = `<section class="card"><p class="eb">${context.label}</p><p class="claim">${context.text}</p><div id="initialPanel"><p>${t("beforeCheck")}</p><div id="sl1"></div><button class="btn" id="lock"><span>${t("lockBtn")}</span></button></div><p class="mut" id="storageNotice" role="status"></p></section>`;
  const getInitial = slider($("#sl1"), context.initial === null ? 50 : context.initial);
  // A default probability of 50% is valid; do not require an arbitrary slider movement to enable this action.
  $("#lock").addEventListener("click", () => {
    context.initial = getInitial();
    context.finalNow = context.initial;
    S.phase = "trial_evidence";
    logEvent("initial", { item: context.item.id, probability: context.initial, variant: context.variant });
    renderTrialEvidence();
  });
  if (S.persistenceWarning) showPersistenceWarning();
}

function renderTrialEvidence() {
  const context = S.currentTrial;
  if (!context) return resumeSession();
  if (!context.activeSince) context.activeSince = Date.now();
  setPhase("trial_evidence");
  heading(context.flow === "test" ? 2 : 1);
  const item = context.item;
  const expanded = new Set(context.expanded || []);
  const opened = new Set(context.opened || []);
  view().innerHTML = `<section class="card"><p class="eb">${context.label}</p><p class="claim">${context.text}</p><p class="eb">${t("checkBeyond")}</p><div id="sourceList">${item.e.map((source, index) => `<button class="sb${expanded.has(index) ? " on" : ""}" data-k="${index}" aria-expanded="${expanded.has(index)}">${pick(source[0])}</button><p class="sn" data-source-text="${index}" ${expanded.has(index) ? "" : "hidden"}>${pick(source[1])}</p>`).join("")}</div><p style="margin-top:24px">${t("finalJudge")}</p><div id="sl2"></div><label><input type="checkbox" id="ins" ${context.insufficient ? "checked" : ""}> ${t("insLab")}</label><p style="margin:20px 0 0">${t("shareQ")}</p><label style="margin-top:4px"><input type="radio" name="share" value="1" ${context.share === 1 ? "checked" : ""}> ${t("shareYes")}</label><label style="margin-top:4px"><input type="radio" name="share" value="0" ${context.share === 0 ? "checked" : ""}> ${t("shareNo")}</label><button class="btn" id="submit"><span>${t("submitBtn")}</span></button><p class="mut" id="msg" role="alert"></p></section>`;
  const getFinal = slider($("#sl2"), context.finalNow === null ? context.initial : context.finalNow, value => {
    context.finalNow = value;
    persistSession();
  });
  $("#ins").addEventListener("change", event => { context.insufficient = event.target.checked; persistSession(); });
  rootNode.querySelectorAll('input[name="share"]').forEach(input => input.addEventListener("change", event => { context.share = Number(event.target.value); persistSession(); }));
  rootNode.querySelectorAll(".sb").forEach(button => button.addEventListener("click", () => {
    const index = Number(button.dataset.k);
    const paragraph = rootNode.querySelector(`[data-source-text="${index}"]`);
    const isOpening = paragraph.hidden;
    paragraph.hidden = !isOpening;
    button.classList.toggle("on", isOpening);
    button.setAttribute("aria-expanded", String(isOpening));
    const expansionSet = new Set(context.expanded || []);
    if (isOpening) {
      expansionSet.add(index);
      if (!opened.has(index)) {
        opened.add(index);
        context.opened = Array.from(opened);
      }
      context.expanded = Array.from(expansionSet);
      logEvent("source_open", { item: item.id, source_index: index, source: item.e[index][0][0], variant: context.variant });
    } else {
      expansionSet.delete(index);
      context.expanded = Array.from(expansionSet);
      logEvent("source_close", { item: item.id, source_index: index, source: item.e[index][0][0], variant: context.variant });
    }
    persistSession();
  }));
  $("#submit").addEventListener("click", () => {
    const finalValue = getFinal();
    const shareInput = rootNode.querySelector('input[name="share"]:checked');
    const message = $("#msg");
    if (context.opened.length < context.need || !shareInput) {
      message.textContent = context.need ? t("needOpenMsg") : t("chooseMsg");
      return;
    }
    context.finalNow = finalValue;
    context.insufficient = $("#ins").checked;
    context.share = Number(shareInput.value);
    context.elapsedMs = currentTrialElapsed(context);
    context.activeSince = null;
    const result = {
      item: item.id,
      veracity: item.v,
      variant: context.variant,
      initial_probability: context.initial,
      final_probability: finalValue,
      evidence_insufficient: context.insufficient,
      forwarded: context.share,
      sources_opened: context.opened.slice(),
      trial_elapsed_ms: Math.round(context.elapsedMs)
    };
    S.lastResult = result;
    if (context.recordResult) S.res.push(result);
    context.submitted = true;
    setPhase(context.feedback ? "feedback" : "transition");
    logEvent("final", result);
    if (context.feedback) renderFeedback();
    else continueAfterTrial();
  });
  if (S.persistenceWarning) showPersistenceWarning();
}

function renderFeedback() {
  const context = S.currentTrial;
  if (!context || !S.lastResult) return resumeSession();
  setPhase("feedback");
  heading(1);
  const result = S.lastResult;
  view().innerHTML = `<section class="card"><p class="eb">${t("fbEb")}</p><p class="claim">${context.text}</p>${evidenceHTML(context.item)}<p class="mut">${fill(t("yourJudgment"), { a: result.initial_probability, b: result.final_probability })}</p><button class="btn" id="next"><span>${t("contBtn")}</span></button></section>`;
  $("#next").addEventListener("click", continueAfterTrial);
}
function continueAfterTrial() {
  const context = S.currentTrial;
  if (!context) return home();
  const flow = context.flow;
  const nextIndex = context.nextIndex;
  S.currentTrial = null;
  S.lastResult = null;
  S.phase = flow === "test" ? "test" : "training";
  persistSession();
  if (flow === "test") test(nextIndex);
  else train(nextIndex);
}

function test(index) {
  heading(2);
  if (!S.Q.length) {
    // Balance the two presentation variants before shuffling the item order.
    S.Q = shuffle(TEST.map((item, i) => ({ ...item, variant: (i + S.flip) % 2 ? "alternative_wording" : "original_wording" })));
    S.testIndex = index;
    S.phase = "test";
    logEvent("test_start", { item_count: S.Q.length, variant_flip: S.flip });
  }
  if (index >= S.Q.length) return debrief();
  S.testIndex = index;
  setPhase("test");
  const item = S.Q[index];
  const text = item.variant === "alternative_wording" ? pick(item.a) : pick(item.h);
  trial(item, text, { label: fill(t("claimOf"), { n: index + 1, m: S.Q.length }), need: 0, feedback: false, recordResult: true, variant: item.variant, flow: "test", nextIndex: index + 1 });
}

// Acklam's inverse-normal approximation, used after applying a log-linear correction to rates.
function inverseNormal(p) {
  if (!(p > 0 && p < 1)) return NaN;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  const high = 1 - low;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > high) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function stats() {
  const results = S.res.filter(result => Number.isFinite(result.final_probability) && [0, 1].includes(result.veracity));
  const trueItems = results.filter(result => result.veracity === 1);
  const falseItems = results.filter(result => result.veracity === 0);
  const hits = trueItems.filter(result => result.final_probability > 50).length;
  const falseAlarms = falseItems.filter(result => result.final_probability > 50).length;
  const hitRate = trueItems.length ? (hits + 0.5) / (trueItems.length + 1) : NaN;
  const falseAlarmRate = falseItems.length ? (falseAlarms + 0.5) / (falseItems.length + 1) : NaN;
  return {
    n: results.length,
    dPrime: Number.isFinite(hitRate) && Number.isFinite(falseAlarmRate) ? inverseNormal(hitRate) - inverseNormal(falseAlarmRate) : NaN,
    criterion: Number.isFinite(hitRate) && Number.isFinite(falseAlarmRate) ? -(inverseNormal(hitRate) + inverseNormal(falseAlarmRate)) / 2 : NaN,
    brier: results.length ? results.reduce((sum, result) => sum + (result.final_probability / 100 - result.veracity) ** 2, 0) / results.length : NaN
  };
}
function metric(value, digits = 2) { return Number.isFinite(value) ? value.toFixed(digits) : "—"; }
function debrief() {
  setPhase("debrief");
  heading(3);
  if (!S.log.some(event => event.type === "complete")) logEvent("complete", { item_count: S.res.length });
  const summary = stats();
  const falseItems = TRAIN.concat(TEST).filter(item => !item.v);
  view().innerHTML = `<h1>${t("thanks")}</h1><section class="card"><p class="eb">${t("corrEb")}</p><p>${t("corrIntro")}</p>${falseItems.map(item => `<p><b>${pick(item.x || item.h)}</b><br><span class="mut">${pick(item.e[0][0])}: ${pick(item.e[0][1])}</span></p>`).join("")}</section><section class="card"><p class="eb">${t("sumEb")}</p><p class="mut">${t("sumNote")}</p><table><tr><th>${t("rowValid")}</th><td>${summary.n} / ${TEST.length}</td></tr><tr><th>${t("rowD")}</th><td>${metric(summary.dPrime)}</td></tr><tr><th>${t("rowC")}</th><td>${metric(summary.criterion)}</td></tr><tr><th>${t("rowBrier")}</th><td>${metric(summary.brier, 3)}</td></tr><tr><th>${t("rowArm")}</th><td>${S.arm} / ${S.flip}</td></tr></table><small>${t("sumSmall")}</small><details style="margin-top:16px"><summary>${t("logSummary")}</summary><textarea readonly id="out" aria-label="Session event log"></textarea></details><div class="export-actions"><button class="btn" id="copy"><span>${t("copyBtn")}</span></button><button class="btn secondary" id="download"><span>${t("dlBtn")}</span></button></div><p id="exportMessage" class="mut" role="status"></p><p class="mut">${t("logNote")}</p></section>`;
  $("#out").value = JSON.stringify({ schema: 2, site: "aloop", experiment_id: "believe", app_version: "0.1.0", pid: S.pid, arm: S.arm, exported_at: new Date().toISOString(), events: S.log }, null, 2);
  $("#copy").addEventListener("click", copyExport);
  $("#download").addEventListener("click", downloadExport);
}
async function copyExport() {
  const output = $("#out");
  const message = $("#exportMessage");
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(output.value);
    message.textContent = t("copiedMsg");
  } catch (_) {
    output.focus();
    output.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
    message.textContent = copied ? t("copiedMsg") : t("copyBlockMsg");
  }
}
function downloadExport() {
  const data = { schema: 2, site: "aloop", experiment_id: "believe", app_version: "0.1.0", pid: S.pid, arm: S.arm, exported_at: new Date().toISOString(), events: S.log };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aloop-believe-${S.pid || "pilot"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#exportMessage").textContent = t("dlMsg");
}

function resumeSession() {
  if (!S.pid || !S.arm) return startNewSession((runtimeContext && runtimeContext.arm) || "A");
  if (S.currentTrial && !S.currentTrial.activeSince && !S.currentTrial.submitted) {
    S.currentTrial.activeSince = Date.now();
    persistSession();
  }
  switch (S.phase) {
    case "consent": return consent();
    case "training": return train(S.trainIndex || 0);
    case "lesson": return train(S.trainIndex || 0);
    case "neutral": return neutral(S.neutralRound || 1);
    case "trial_initial": return renderTrialInitial();
    case "trial_evidence": return renderTrialEvidence();
    case "feedback": return renderFeedback();
    case "transition": return continueAfterTrial();
    case "test": return test(S.testIndex || 0);
    case "debrief": return debrief();
    default: return home();
  }
}

// Pause the active-time counter when the tab is left or refreshed; it resumes on the next render.
window.addEventListener("pagehide", () => {
  if (S.currentTrial && S.currentTrial.activeSince) {
    S.currentTrial.elapsedMs = currentTrialElapsed(S.currentTrial);
    S.currentTrial.activeSince = null;
  }
  saveAll();
});
window.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && rootNode) {
    const button = Array.from(rootNode.querySelectorAll(".btn")).find(candidate => !candidate.disabled && candidate.offsetParent);
    if (button) button.click();
  }
});

function syncCurrentTrialText() {
  const current = S.currentTrial;
  if (!current || !current.item) return;
  if (current.variant === "training") current.text = pick(current.item.x);
  else if (current.flow === "test") {
    current.text = current.item.variant === "alternative_wording" ? pick(current.item.a) : pick(current.item.h);
  }
}
function rerenderCurrent() {
  if (!isMounted || !rootNode) return;
  syncCurrentTrialText();
  if (S.pid && S.arm && S.phase && S.phase !== "home") resumeSession();
  else startNewSession((runtimeContext && runtimeContext.arm) || "A");
}
function hasResumable() {
  return Boolean(S.pid && S.arm && S.phase && S.phase !== "home");
}
function mount(root, context, options = {}) {
  rootNode = root;
  runtimeContext = context || {};
  isMounted = true;
  lang = runtimeContext.lang === "en" ? "en" : "zh";
  if (options.fresh) startNewSession(runtimeContext.arm || "A");
  else if (hasResumable()) resumeSession();
  else startNewSession(runtimeContext.arm || "A");
  if (S.persistenceWarning) showPersistenceWarning();
  return unmount;
}
function unmount() {
  if (!isMounted) return;
  if (S.currentTrial && S.currentTrial.activeSince) {
    S.currentTrial.elapsedMs = currentTrialElapsed(S.currentTrial);
    S.currentTrial.activeSince = null;
  }
  saveAll();
  isMounted = false;
  rootNode = null;
  runtimeContext = null;
}
function onLangChange(next) {
  lang = next === "en" ? "en" : "zh";
  if (isMounted) {
    if (S.pid && S.arm) logEvent("lang", { lang });
    rerenderCurrent();
  }
}
function getPhase() { return S.phase; }
Aloop.experiments = Aloop.experiments || {};
Aloop.experiments.believe = { hasResumable, mount, onLangChange, unmount, getPhase };
Aloop.experimentApi = Aloop.experiments.believe;
