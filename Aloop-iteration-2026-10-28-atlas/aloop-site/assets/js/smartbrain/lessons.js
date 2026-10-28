/* Smart Brain lessons (bilingual). Educational text; scientific review recommended before release. */
(function () {
  const Aloop = window.Aloop = window.Aloop || {};
  Aloop.lessons = [
    { id: "cortex",
      title: { zh: "大脑皮层概览", en: "The cerebral cortex at a glance" },
      body: {
        zh: ["大脑皮层是覆盖在大脑表面的一层灰质，厚度约两到四毫米。它由数十亿个神经元组成，负责感知、运动控制、语言、记忆和决策等高级功能。",
             "为了在有限的颅腔内容纳更大的表面积，皮层折叠成许多隆起和沟槽。展开后，人类大脑皮层的面积可达约两千平方厘米。",
             "皮层大致分为六层细胞结构，不同区域各层的厚度和细胞类型有所差异，这是划分功能区的重要依据之一。"],
        en: ["The cerebral cortex is a thin sheet of gray matter covering the surface of the brain, roughly two to four millimetres thick. It contains billions of neurons and supports perception, movement control, language, memory and decision making.",
             "To fit a large surface area inside the skull, the cortex folds into ridges and grooves. Unfolded, the human cortex would cover about two thousand square centimetres.",
             "The cortex has six main cellular layers. The thickness and cell types of each layer differ between regions, which is one basis for mapping functional areas."] } },
    { id: "hemispheres",
      title: { zh: "左右半球与胼胝体", en: "Hemispheres and the corpus callosum" },
      body: {
        zh: ["大脑分为左右两个半球，中间由纵裂分开。两个半球的外形大体对称，但在功能上存在一定的分工。",
             "例如，对多数右利手的人来说，语言加工更依赖左半球，而空间注意与面孔加工更依赖右半球。这种差异是倾向性的，而不是绝对的。",
             "胼胝体是连接两个半球的一束粗大的神经纤维，包含约两亿根轴突，使两侧大脑可以快速交换信息。"],
        en: ["The brain is divided into left and right hemispheres, separated by the longitudinal fissure. The two halves look broadly symmetrical but differ somewhat in function.",
             "For example, in most right-handed people language processing relies more on the left hemisphere, while spatial attention and face processing rely more on the right. These differences are tendencies, not absolutes.",
             "The corpus callosum is a thick bundle of nerve fibres joining the hemispheres. It contains roughly two hundred million axons and lets both sides exchange information quickly."] } },
    { id: "lobes",
      title: { zh: "四个脑叶", en: "The four lobes" },
      body: {
        zh: ["每个半球通常被划分为四个脑叶：额叶、顶叶、颞叶和枕叶。这些名称来自覆盖它们的颅骨。",
             "额叶位于前部，参与计划、决策和运动控制。顶叶位于上后方，整合触觉与空间信息。",
             "颞叶位于两侧下方，与听觉、语言理解和记忆有关。枕叶位于最后方，主要处理视觉信息。"],
        en: ["Each hemisphere is usually divided into four lobes: frontal, parietal, temporal and occipital. The names come from the skull bones that cover them.",
             "The frontal lobe sits at the front and is involved in planning, decision making and motor control. The parietal lobe lies behind it and integrates touch and spatial information.",
             "The temporal lobe lies low on the side and relates to hearing, language comprehension and memory. The occipital lobe, at the back, mainly processes vision."] } },
    { id: "folds",
      title: { zh: "脑回与脑沟", en: "Gyri and sulci" },
      body: {
        zh: ["皮层表面的隆起称为脑回，凹陷的沟槽称为脑沟，特别深的沟称为脑裂。",
             "中央沟分隔额叶与顶叶，外侧裂分隔颞叶与额叶、顶叶。它们是在影像中辨认脑区的重要标志。",
             "折叠的模式在个体之间并不完全相同，就像指纹一样，各人有各人的细节差异。"],
        en: ["The ridges on the cortical surface are called gyri, the grooves are called sulci, and particularly deep grooves are called fissures.",
             "The central sulcus separates the frontal and parietal lobes, and the lateral fissure separates the temporal lobe from the frontal and parietal lobes. They are key landmarks for identifying regions in brain images.",
             "The folding pattern is not identical between people. Like fingerprints, each brain has its own details."] } },
    { id: "areas",
      title: { zh: "功能分区", en: "Functional areas" },
      body: {
        zh: ["初级运动皮层位于中央前回，控制随意运动。初级体感皮层位于中央后回，接收来自身体的触觉信号。",
             "初级视觉皮层位于枕叶，初级听觉皮层位于颞叶上部。这些区域的信息会传送到更高级的联合皮层进行整合。",
             "语言相关的布罗卡区和韦尼克区通常位于左半球。不过，大脑功能往往依赖多个区域组成的网络，而不是单一的位置。"],
        en: ["The primary motor cortex lies in the precentral gyrus and controls voluntary movement. The primary somatosensory cortex lies in the postcentral gyrus and receives touch signals from the body.",
             "The primary visual cortex is in the occipital lobe and the primary auditory cortex is in the upper temporal lobe. Their signals pass on to higher association areas for integration.",
             "Broca's area and Wernicke's area, linked to language, are usually in the left hemisphere. Still, brain functions usually depend on networks of regions rather than on a single place."] } },
    { id: "model",
      title: { zh: "如何阅读三维模型", en: "How to read the 3-D model" },
      body: {
        zh: ["首页的粒子大脑由许多微小的四面体组成，它们分布在左右两个半球的表面上，两个半球之间的缝隙对应纵裂。",
             "移动鼠标时模型会随之转动；点击时粒子会向外扩散，随后回到原位。这些效果只是视觉演示。",
             "该模型来自开放的解剖数据，仅用于教育展示，不能用于诊断或手术规划。"],
        en: ["The particle brain on the home page is made of many small tetrahedra spread over the surfaces of the left and right hemispheres. The gap between them corresponds to the longitudinal fissure.",
             "The model turns as you move the pointer. When you click, the particles expand outward and then return to their places. These effects are purely visual.",
             "The model comes from open anatomical data and is for education only. It must not be used for diagnosis or surgical planning."] } },
  ];
})();
