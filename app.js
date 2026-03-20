const sampleCourse = {
  title: "用户研究实战课：从访谈到产品洞察",
  audience: "转岗产品经理、初级研究员、自学型学习者",
  goal: "快速抓住课程主线，并把方法论整理成可复习的脑图",
  depth: "标准版（平衡清晰度与信息量）",
  transcript: `这节课我们讲，如何把用户访谈真正变成可执行的产品洞察。很多人做访谈的时候，上来就问用户想要什么功能，这其实是一个很常见的误区，因为用户说出来的往往是表层表达，不一定是底层问题。

第一部分，我们先明确用户研究的目标。研究不是为了验证自己是对的，而是为了理解用户在什么场景下遇到了什么阻力，以及他们现在是如何解决的。只有把场景和行为链条看清楚，后面的判断才不会失真。

第二部分，我们讲访谈设计。先写清楚你要验证的核心问题，再把问题拆成开放式提问，不要连续提封闭问题。比如你可以问，最近一次遇到这个问题是什么时候，当时你先做了什么，后来为什么没有继续。这样的问法更容易拿到真实细节。

这里举一个例子。如果你做的是求职类产品，不要直接问用户想不想要 AI 改简历，你应该先理解他是怎么准备简历的，在哪个环节最卡，为什么之前的方法没有用。案例里我们看到，很多用户真正卡住的不是不会写，而是不知道岗位到底看重什么。

第三部分，我们讲整理洞察。访谈结束以后，不要直接写结论，先分离事实、原话、解释和推断。事实是用户做了什么，原话是用户怎么表达，解释是你对原因的初步理解，推断才是你认为可能存在的机会点。

注意，这里还有两个常见误区。第一个是把个别用户的话当成普遍规律，第二个是研究完以后没有回到业务目标，导致洞察很好看但不能行动。你要避免只讲故事不讲判断，也要避免只有判断没有证据。

最后，我们把洞察沉淀成行动建议。建议至少输出四类内容：核心问题、用户分群、机会点和下一步验证计划。你回去以后可以立刻做一件事，就是拿一份你之前的访谈记录，重新按事实、解释、推断三层拆开，再看看哪些地方其实混在一起了。`
};

const state = {
  activePromptTab: "system",
  latestMap: null,
  latestPrompts: null,
  graph: null,
  nodePositions: {},
  canvas: {
    x: 0,
    y: 0,
    scale: 0.72,
  },
  interaction: null,
};

const WORLD = {
  width: 4200,
  height: 3200,
  centerX: 2100,
  centerY: 1600,
};

const elements = {
  form: document.querySelector("#source-form"),
  title: document.querySelector("#course-title"),
  audience: document.querySelector("#course-audience"),
  goal: document.querySelector("#course-goal"),
  depth: document.querySelector("#course-depth"),
  transcript: document.querySelector("#course-transcript"),
  loadSample: document.querySelector("#load-sample"),
  clearForm: document.querySelector("#clear-form"),
  mapSummary: document.querySelector("#map-summary"),
  mindmap: document.querySelector("#mindmap"),
  metrics: document.querySelector("#metrics"),
  markdownOutput: document.querySelector("#markdown-output"),
  systemPrompt: document.querySelector("#system-prompt"),
  userPrompt: document.querySelector("#user-prompt"),
  refinePrompt: document.querySelector("#refine-prompt"),
  schemaPrompt: document.querySelector("#schema-prompt"),
  copyActivePrompt: document.querySelector("#copy-active-prompt"),
  downloadJson: document.querySelector("#download-json"),
  downloadMarkdown: document.querySelector("#download-markdown"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomReset: document.querySelector("#zoom-reset"),
  zoomIn: document.querySelector("#zoom-in"),
  relayoutMap: document.querySelector("#relayout-map"),
  zoomLevel: document.querySelector("#zoom-level"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  panes: Array.from(document.querySelectorAll(".prompt-pane")),
  copyTargets: Array.from(document.querySelectorAll("[data-copy-target]")),
};

const categoryRules = [
  { label: "核心问题", matcher: /问题|痛点|卡住|阻力|困难|难点|为什么|矛盾/ },
  { label: "核心概念", matcher: /核心|关键|本质|定义|理解|概念|原则|目标|框架|模型|判断|底层/ },
  { label: "方法步骤", matcher: /步骤|流程|方法|先|再|然后|最后|第一|第二|第三|拆成|分成|执行|操作|设计/ },
  { label: "案例场景", matcher: /例如|比如|案例|场景|举例|示例|实战|真实|如果你做的是/ },
  { label: "易错提醒", matcher: /注意|不要|避免|误区|陷阱|常见问题|风险|别把|不能/ },
  { label: "行动建议", matcher: /建议|可以|应该|记得|练习|行动|立刻|马上|回去以后|下一步/ },
];

const chineseStopPhrases = [
  "大家好",
  "我们来讲",
  "这一节",
  "这节课",
  "今天我们",
  "其实",
  "就是",
  "然后",
  "接下来",
  "最后",
  "所以",
];

const debounce = (fn, wait = 240) => {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeText = (text) =>
  text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitIntoSentences = (text) => {
  const matched = normalizeText(text).match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [];
  return matched
    .map((sentence) =>
      sentence
        .replace(/^\s*[-*•\d一二三四五六七八九十(（).、]+\s*/, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
};

const shorten = (text, maxLength) => {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}…` : compact;
};

const removeTimestamps = (text) =>
  text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "").replace(/\s+/g, " ").trim();

const cleanLead = (text) => {
  let cleaned = removeTimestamps(text);
  chineseStopPhrases.forEach((phrase) => {
    cleaned = cleaned.replaceAll(phrase, "");
  });
  return cleaned.replace(/^[，。；：、\s]+/, "").trim();
};

const uniqueItems = (items, limit = 4) => {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    const normalized = item.replace(/[，。；：!！?？\s]+/g, "");
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    output.push(item);
  });

  return output.slice(0, limit);
};

const splitIntoBlocks = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => removeTimestamps(item).length > 14);

  let blocks = paragraphs;

  if (blocks.length < 3) {
    const lines = normalized
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => removeTimestamps(item).length > 14);
    blocks = lines;
  }

  if (blocks.length < 3) {
    const sentences = splitIntoSentences(normalized);
    const chunkSize = sentences.length > 18 ? 3 : 2;
    blocks = [];

    for (let index = 0; index < sentences.length; index += chunkSize) {
      blocks.push(sentences.slice(index, index + chunkSize).join(" "));
    }
  }

  const merged = [];
  blocks.forEach((block) => {
    if (!merged.length) {
      merged.push(block);
      return;
    }

    const previous = merged[merged.length - 1];
    if (removeTimestamps(previous).length < 42) {
      merged[merged.length - 1] = `${previous} ${block}`.trim();
      return;
    }

    merged.push(block);
  });

  return merged.slice(0, 8);
};

const createBranchTitle = (block, index) => {
  const cleanedBlock = cleanLead(block);
  const firstLine = cleanedBlock.split("\n")[0].trim();

  const headingMatch = firstLine.match(
    /^(?:第[一二三四五六七八九十0-9]+(?:部分|节|讲|章)|[一二三四五六七八九十]+、|\d+[.)、])\s*([^。！？!?]{2,20})/
  );
  if (headingMatch?.[1]) {
    return shorten(headingMatch[1].trim(), 16);
  }

  const colonMatch = firstLine.match(/^(.{2,16})[:：]/);
  if (colonMatch?.[1]) {
    return shorten(colonMatch[1].trim(), 16);
  }

  const firstSentence = splitIntoSentences(cleanedBlock)[0] || cleanedBlock;
  const compressed = firstSentence
    .replace(/^(我们|先|再|然后|最后|这一部分|这里|接下来)/, "")
    .replace(/[，。！？!?；;].*$/, "")
    .trim();

  return shorten(compressed || `模块 ${index + 1}`, 16);
};

const buildClusters = (sentences) => {
  const used = new Set();
  const clusters = [];

  categoryRules.forEach(({ label, matcher }) => {
    const matched = [];

    sentences.forEach((sentence) => {
      const normalized = sentence.replace(/[，。；：!！?？\s]+/g, "");
      if (!matcher.test(sentence) || used.has(normalized)) {
        return;
      }

      matched.push(shorten(sentence, 32));
      used.add(normalized);
    });

    if (matched.length) {
      clusters.push({
        label,
        items: uniqueItems(matched, label === "方法步骤" ? 5 : 4),
      });
    }
  });

  if (!clusters.length) {
    return [
      {
        label: "关键要点",
        items: uniqueItems(sentences.map((sentence) => shorten(sentence, 32)), 4),
      },
    ];
  }

  const fallback = uniqueItems(
    sentences
      .filter((sentence) => sentence.length > 6)
      .map((sentence) => shorten(sentence, 32)),
    3
  );

  if (fallback.length && !clusters.some((cluster) => cluster.label === "关键要点")) {
    clusters.unshift({
      label: "关键要点",
      items: fallback,
    });
  }

  return clusters.slice(0, 6);
};

const analyzeBlock = (block, index) => {
  const sentences = uniqueItems(
    splitIntoSentences(block)
      .map((sentence) => cleanLead(sentence))
      .filter((sentence) => sentence.length > 5),
    10
  );

  return {
    title: createBranchTitle(block, index),
    summary: shorten(sentences[0] || cleanLead(block), 42),
    clusters: buildClusters(sentences),
  };
};

const collectFormData = () => ({
  title: elements.title.value.trim() || "未命名课程",
  audience: elements.audience.value.trim() || "通用学习者",
  goal: elements.goal.value.trim() || "提炼课程结构并形成复习脑图",
  depth: elements.depth.value,
  transcript: elements.transcript.value.trim(),
});

const computeStatsFromMap = (mapData) => {
  const branches = mapData.branches || [];

  const nodeCount = branches.reduce(
    (sum, branch) =>
      sum +
      1 +
      (branch.clusters || []).reduce(
        (clusterSum, cluster) => clusterSum + 1 + (cluster.items || []).length,
        0
      ),
    1
  );

  const actionCount = branches.reduce(
    (sum, branch) =>
      sum +
      (branch.clusters || [])
        .filter((cluster) => cluster.label === "行动建议")
        .reduce((clusterSum, cluster) => clusterSum + (cluster.items || []).length, 0),
    0
  );

  const warningCount = branches.reduce(
    (sum, branch) =>
      sum +
      (branch.clusters || [])
        .filter((cluster) => cluster.label === "易错提醒")
        .reduce((clusterSum, cluster) => clusterSum + (cluster.items || []).length, 0),
    0
  );

  return {
    moduleCount: branches.length,
    nodeCount,
    actionCount,
    warningCount,
  };
};

const buildOverviewFromMap = (mapData) => {
  const branches = mapData.branches || [];
  const firstBranch = branches[0]?.title || "课程起点";
  const lastBranch = branches[branches.length - 1]?.title || "课程收束";
  const actionCount = computeStatsFromMap(mapData).actionCount;

  return [
    `《${mapData.root.title}》目前被整理为 ${branches.length} 个核心模块，主线从“${firstBranch}”推进到“${lastBranch}”。`,
    `它更适合 ${mapData.root.audience}，目标集中在“${mapData.root.goal}”。`,
    actionCount
      ? `当前导图里已经抽出了 ${actionCount} 条可执行行动建议，适合继续转成复习卡片或课后练习。`
      : "当前内容更偏概念与框架整理，后续可以补充课后行动项。",
  ].join(" ");
};

const buildCourseMap = (formData) => {
  const transcript = normalizeText(formData.transcript);
  const blocks = splitIntoBlocks(transcript);
  const branches = blocks.map(analyzeBlock).filter((branch) => branch.clusters.length);

  const mapData = {
    root: {
      title: formData.title,
      audience: formData.audience,
      goal: formData.goal,
      depth: formData.depth,
    },
    transcriptLength: transcript.length,
    summary: "",
    branches,
    stats: {
      moduleCount: 0,
      nodeCount: 0,
      actionCount: 0,
      warningCount: 0,
    },
  };

  mapData.stats = computeStatsFromMap(mapData);
  mapData.summary = buildOverviewFromMap(mapData);

  return mapData;
};

const buildMarkdown = (mapData) => {
  const lines = [
    `# ${mapData.root.title}`,
    "",
    `- 目标学习者：${mapData.root.audience}`,
    `- 学习目标：${mapData.root.goal}`,
    `- 结构深度：${mapData.root.depth}`,
    "",
    "## 课程总览",
    mapData.summary,
    "",
  ];

  mapData.branches.forEach((branch, index) => {
    lines.push(`## ${String(index + 1).padStart(2, "0")} ${branch.title}`);
    lines.push(`- 模块摘要：${branch.summary}`);

    branch.clusters.forEach((cluster) => {
      lines.push(`- ${cluster.label}`);
      cluster.items.forEach((item) => {
        lines.push(`  - ${item}`);
      });
    });

    lines.push("");
  });

  return lines.join("\n").trim();
};

const buildSchemaPrompt = () => `{
  "root": {
    "title": "课程标题",
    "audience": "目标学习者",
    "goal": "学习目标",
    "depth": "结构深度"
  },
  "summary": "课程主线摘要",
  "branches": [
    {
      "title": "一级分支名称",
      "summary": "该分支的一句话摘要",
      "clusters": [
        {
          "label": "核心概念 | 方法步骤 | 案例场景 | 易错提醒 | 行动建议",
          "items": ["节点 1", "节点 2", "节点 3"]
        }
      ]
    }
  ]
}`;

const buildPrompts = (formData, mapData) => {
  const schemaText = buildSchemaPrompt();

  const systemPrompt = `你是一名“课程知识架构师 + 学习设计师 + 思维导图编辑器”。

你的任务是把视频课程、训练营录播、直播回放或老师讲解内容，压缩成适合学习、复习、检索和二次创作的结构化脑图。

必须遵守以下原则：
1. 只依据用户提供的原始内容，不补写课程里没有明确讲到的事实。
2. 先清理口头禅、寒暄、重复表达和跑题段落，再做结构化提炼。
3. 优先还原课程主线：问题 -> 概念 -> 原理 -> 方法 -> 案例 -> 易错点 -> 行动项。
4. 每个节点尽量用短语表达，优先 6-18 个字，避免整段照抄字幕。
5. 如果一个分支同时包含概念、步骤、案例和提醒，必须拆成子节点，不要混在同一句里。
6. 优先保留真正有学习价值的信息：定义、判断标准、步骤顺序、适用场景、反例、复盘动作。
7. 当原文没有充分展开时，明确标注“原文未展开”，不要脑补。

输出要求：
- 先输出 Markdown 层级脑图。
- 再输出 JSON，字段必须严格遵循给定 schema。
- 全部使用中文，表达清晰、克制、教学友好。`;

  const userPrompt = `请把下面这门课程整理成结构化脑图。

课程标题：${formData.title}
目标学习者：${formData.audience}
学习目标：${formData.goal}
结构深度偏好：${formData.depth}

整理要求：
1. 先判断课程主线和章节切分。
2. 每个一级分支给一句摘要。
3. 一级分支控制在 4-8 个之间。
4. 每个分支优先抽取：核心问题、关键概念、方法步骤、案例场景、易错提醒、行动建议。
5. 删除无信息量口语，不要把字幕逐句搬运成脑图。
6. 节点尽量短句化，方便复习和做知识卡片。

请按以下顺序输出：
A. Markdown 脑图
B. JSON

JSON schema：
${schemaText}

课程原始内容：
"""${formData.transcript || "请在此替换为课程字幕或学习笔记。"}"""`;

  const refinePrompt = `请对当前课程脑图做第二轮精炼，目标是“更清晰、更适合学习者复习”，并遵守以下要求：

1. 合并重复节点，删除意义接近但表述不同的内容。
2. 如果某个分支太深或太散，把它压缩成更稳定的 3 层结构。
3. 把抽象表述改写成学习者更容易理解的短语。
4. 对方法类分支，优先保留“先做什么，再做什么，为什么这样做”。
5. 对案例类分支，保留触发场景、典型表现和对应启发。
6. 对提醒类分支，明确区分“常见误区”和“行动建议”。
7. 输出时继续保持 Markdown 脑图 + JSON 双格式。

当前课程标题：${formData.title}
当前已生成模块数：${mapData?.stats.moduleCount || 0}
当前总节点数：${mapData?.stats.nodeCount || 0}`;

  return {
    system: systemPrompt,
    user: userPrompt,
    refine: refinePrompt,
    schema: schemaText,
  };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getMapValueByPath = (target, path) =>
  path.split(".").reduce((current, segment) => current?.[Number.isNaN(Number(segment)) ? segment : Number(segment)], target);

const setMapValueByPath = (target, path, value) => {
  const segments = path.split(".");
  let current = target;

  segments.slice(0, -1).forEach((segment) => {
    const key = Number.isNaN(Number(segment)) ? segment : Number(segment);
    current = current[key];
  });

  const finalKey = segments[segments.length - 1];
  current[Number.isNaN(Number(finalKey)) ? finalKey : Number(finalKey)] = value;
};

const renderMetrics = (stats) => {
  const cards = [
    { label: "模块数", value: stats.moduleCount, note: "一级结构切分" },
    { label: "节点数", value: stats.nodeCount, note: "包含聚类与子节点" },
    { label: "行动项", value: stats.actionCount, note: "适合转复习任务" },
    { label: "易错点", value: stats.warningCount, note: "方便课后复盘" },
  ];

  elements.metrics.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.value)}</strong>
          <span>${escapeHtml(card.note)}</span>
        </article>
      `
    )
    .join("");
};

const updateCanvasControls = (disabled) => {
  [elements.zoomOut, elements.zoomReset, elements.zoomIn, elements.relayoutMap].forEach((button) => {
    if (button) {
      button.disabled = disabled;
    }
  });
};

const updateZoomLevel = () => {
  if (elements.zoomLevel) {
    elements.zoomLevel.textContent = `${Math.round(state.canvas.scale * 100)}%`;
  }
};

const toneForIndex = (index) => ["sage", "coral", "gold", "sky"][index % 4];

const buildMindmapGraph = (mapData, { preservePositions = true } = {}) => {
  const nodes = [];
  const edges = [];
  const rightBranches = [];
  const leftBranches = [];

  nodes.push({
    id: "root",
    kind: "root",
    tone: "sage",
    x: WORLD.centerX - 190,
    y: WORLD.centerY - 150,
  });

  mapData.branches.forEach((branch, index) => {
    const entry = { branch, index, tone: toneForIndex(index) };
    if (index % 2 === 0) {
      rightBranches.push(entry);
    } else {
      leftBranches.push(entry);
    }
  });

  const placeSide = (entries, side) => {
    const branchGap = 320;
    const clusterGap = 168;
    const branchStartY = WORLD.centerY - ((entries.length - 1) * branchGap) / 2 - 100;

    entries.forEach(({ branch, index, tone }, sideIndex) => {
      const branchId = `branch-${index}`;
      const branchY = branchStartY + sideIndex * branchGap;
      const branchX = side === "right" ? WORLD.centerX + 430 : WORLD.centerX - 760;

      nodes.push({
        id: branchId,
        kind: "branch",
        tone,
        side,
        index,
        x: branchX,
        y: branchY,
      });
      edges.push({ from: "root", to: branchId });

      const clusters = branch.clusters || [];
      const clusterStartY = branchY - ((clusters.length - 1) * clusterGap) / 2;

      clusters.forEach((cluster, clusterIndex) => {
        const clusterId = `cluster-${index}-${clusterIndex}`;
        const clusterX = side === "right" ? branchX + 360 : branchX - 330;
        const clusterY = clusterStartY + clusterIndex * clusterGap;

        nodes.push({
          id: clusterId,
          kind: "cluster",
          tone,
          side,
          index,
          clusterIndex,
          x: clusterX,
          y: clusterY,
        });
        edges.push({ from: branchId, to: clusterId });
      });
    });
  };

  placeSide(rightBranches, "right");
  placeSide(leftBranches, "left");

  const nextPositions = {};
  nodes.forEach((node) => {
    const existing = preservePositions ? state.nodePositions[node.id] : null;
    nextPositions[node.id] = existing || { x: node.x, y: node.y };
  });

  state.nodePositions = nextPositions;
  return { nodes, edges };
};

const renderNodeMarkup = (node) => {
  const position = state.nodePositions[node.id];

  if (node.kind === "root") {
    return `
      <article
        class="canvas-node node-root tone-${node.tone}"
        data-node="${node.id}"
        data-tone="${node.tone}"
        style="left:${position.x}px; top:${position.y}px;"
      >
        <div class="node-toolbar">
          <span class="node-badge">课程 Root</span>
          <button type="button" class="node-handle" data-drag-handle>拖拽</button>
        </div>
        <div class="node-title editable" contenteditable="true" spellcheck="false" data-path="root.title">${escapeHtml(
          getMapValueByPath(state.latestMap, "root.title")
        )}</div>
        <div class="root-meta-grid">
          <div class="meta-card">
            <span>目标学习者</span>
            <div class="meta-edit editable" contenteditable="true" spellcheck="false" data-path="root.audience">${escapeHtml(
              getMapValueByPath(state.latestMap, "root.audience")
            )}</div>
          </div>
          <div class="meta-card">
            <span>学习目标</span>
            <div class="meta-edit editable" contenteditable="true" spellcheck="false" data-path="root.goal">${escapeHtml(
              getMapValueByPath(state.latestMap, "root.goal")
            )}</div>
          </div>
          <div class="meta-card">
            <span>结构深度</span>
            <div class="meta-edit">${escapeHtml(getMapValueByPath(state.latestMap, "root.depth"))}</div>
          </div>
        </div>
      </article>
    `;
  }

  if (node.kind === "branch") {
    return `
      <article
        class="canvas-node node-branch tone-${node.tone}"
        data-node="${node.id}"
        data-tone="${node.tone}"
        style="left:${position.x}px; top:${position.y}px;"
      >
        <div class="node-toolbar">
          <span class="node-badge">一级分支 ${String(node.index + 1).padStart(2, "0")}</span>
          <button type="button" class="node-handle" data-drag-handle>拖拽</button>
        </div>
        <div class="node-title editable" contenteditable="true" spellcheck="false" data-path="branches.${node.index}.title">${escapeHtml(
          getMapValueByPath(state.latestMap, `branches.${node.index}.title`)
        )}</div>
        <div class="node-summary editable" contenteditable="true" spellcheck="false" data-path="branches.${node.index}.summary">${escapeHtml(
          getMapValueByPath(state.latestMap, `branches.${node.index}.summary`)
        )}</div>
      </article>
    `;
  }

  return `
    <article
      class="canvas-node node-cluster tone-${node.tone}"
      data-node="${node.id}"
      data-tone="${node.tone}"
      style="left:${position.x}px; top:${position.y}px;"
    >
      <div class="node-toolbar">
        <span class="node-badge">子节点</span>
        <button type="button" class="node-handle" data-drag-handle>拖拽</button>
      </div>
      <div class="node-label editable" contenteditable="true" spellcheck="false" data-path="branches.${node.index}.clusters.${node.clusterIndex}.label">${escapeHtml(
        getMapValueByPath(state.latestMap, `branches.${node.index}.clusters.${node.clusterIndex}.label`)
      )}</div>
      <div class="node-items editable" contenteditable="true" spellcheck="false" data-path="branches.${node.index}.clusters.${node.clusterIndex}.items">${escapeHtml(
        (getMapValueByPath(state.latestMap, `branches.${node.index}.clusters.${node.clusterIndex}.items`) || []).join(
          "\n"
        )
      )}</div>
    </article>
  `;
};

const setCanvasEmpty = (message) => {
  state.graph = null;
  state.nodePositions = {};
  elements.mindmap.className = "mindmap-empty";
  elements.mindmap.innerHTML = `<p>${escapeHtml(message)}</p>`;
  elements.canvasSurface = null;
  updateCanvasControls(true);
  updateZoomLevel();
};

const applyCanvasTransform = () => {
  if (!elements.canvasSurface) {
    return;
  }

  elements.canvasSurface.style.transform = `translate(${state.canvas.x}px, ${state.canvas.y}px) scale(${state.canvas.scale})`;
  elements.mindmap.style.setProperty("--grid-offset-x", `${state.canvas.x}px`);
  elements.mindmap.style.setProperty("--grid-offset-y", `${state.canvas.y}px`);
  elements.mindmap.style.setProperty("--grid-size", `${Math.max(20, 42 * state.canvas.scale)}px`);
  updateZoomLevel();
};

const applyNodePosition = (nodeId) => {
  if (!elements.canvasSurface) {
    return;
  }

  const node = elements.canvasSurface.querySelector(`[data-node="${nodeId}"]`);
  const position = state.nodePositions[nodeId];
  if (!node || !position) {
    return;
  }

  node.style.left = `${position.x}px`;
  node.style.top = `${position.y}px`;
};

let pendingLinkFrame = 0;

const renderLinks = () => {
  if (!elements.canvasSurface || !state.graph) {
    return;
  }

  const linkLayer = elements.canvasSurface.querySelector("#mindmap-links");
  if (!linkLayer) {
    return;
  }

  linkLayer.innerHTML = state.graph.edges
    .map((edge) => {
      const fromNode = elements.canvasSurface.querySelector(`[data-node="${edge.from}"]`);
      const toNode = elements.canvasSurface.querySelector(`[data-node="${edge.to}"]`);

      if (!fromNode || !toNode) {
        return "";
      }

      const fromX = fromNode.offsetLeft;
      const fromY = fromNode.offsetTop;
      const fromW = fromNode.offsetWidth;
      const fromH = fromNode.offsetHeight;
      const toX = toNode.offsetLeft;
      const toY = toNode.offsetTop;
      const toW = toNode.offsetWidth;
      const toH = toNode.offsetHeight;
      const goingRight = toX > fromX;
      const startX = goingRight ? fromX + fromW : fromX;
      const endX = goingRight ? toX : toX + toW;
      const startY = fromY + fromH / 2;
      const endY = toY + toH / 2;
      const controlOffset = Math.max(90, Math.abs(endX - startX) * 0.36);
      const d = [
        `M ${startX} ${startY}`,
        `C ${startX + (goingRight ? controlOffset : -controlOffset)} ${startY},`,
        `${endX + (goingRight ? -controlOffset : controlOffset)} ${endY},`,
        `${endX} ${endY}`,
      ].join(" ");

      return `<path class="mindmap-link" d="${d}"></path>`;
    })
    .join("");
};

const scheduleLinkRender = () => {
  if (pendingLinkFrame) {
    return;
  }

  pendingLinkFrame = window.requestAnimationFrame(() => {
    pendingLinkFrame = 0;
    renderLinks();
  });
};

const centerCanvas = () => {
  if (!state.graph) {
    return;
  }

  const rect = elements.mindmap.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const nextScale = rect.width < 720 ? 0.5 : 0.72;
  state.canvas.scale = nextScale;
  state.canvas.x = rect.width / 2 - WORLD.centerX * nextScale;
  state.canvas.y = rect.height / 2 - WORLD.centerY * nextScale;
  applyCanvasTransform();
};

const zoomCanvas = (factor, anchorX, anchorY) => {
  if (!state.graph) {
    return;
  }

  const nextScale = clamp(state.canvas.scale * factor, 0.4, 1.6);
  if (nextScale === state.canvas.scale) {
    return;
  }

  const worldX = (anchorX - state.canvas.x) / state.canvas.scale;
  const worldY = (anchorY - state.canvas.y) / state.canvas.scale;
  state.canvas.x = anchorX - worldX * nextScale;
  state.canvas.y = anchorY - worldY * nextScale;
  state.canvas.scale = nextScale;
  applyCanvasTransform();
};

const syncFormInputsFromMap = () => {
  if (!state.latestMap) {
    return;
  }

  elements.title.value = state.latestMap.root.title;
  elements.audience.value = state.latestMap.root.audience;
  elements.goal.value = state.latestMap.root.goal;
};

const syncDerivedOutputs = () => {
  if (!state.latestMap) {
    return;
  }

  state.latestMap.stats = computeStatsFromMap(state.latestMap);
  state.latestMap.summary = buildOverviewFromMap(state.latestMap);
  elements.mapSummary.textContent = state.latestMap.summary;
  renderMetrics(state.latestMap.stats);
  elements.markdownOutput.value = buildMarkdown(state.latestMap);
  syncFormInputsFromMap();
  state.latestPrompts = buildPrompts(collectFormData(), state.latestMap);
  renderPrompts(state.latestPrompts);
};

const renderMindmap = (mapData, { preservePositions = false, resetView = true } = {}) => {
  if (!mapData.branches.length) {
    setCanvasEmpty("当前内容太少，暂时无法切分出可用模块。可以补充更多字幕稿或课程笔记。");
    return;
  }

  state.graph = buildMindmapGraph(mapData, { preservePositions });
  elements.mindmap.className = "mindmap-canvas";
  elements.mindmap.innerHTML = `
    <div class="canvas-surface" id="canvas-surface">
      <svg class="mindmap-links" id="mindmap-links" viewBox="0 0 ${WORLD.width} ${WORLD.height}" preserveAspectRatio="none"></svg>
      ${state.graph.nodes.map((node) => renderNodeMarkup(node)).join("")}
    </div>
  `;

  elements.canvasSurface = elements.mindmap.querySelector("#canvas-surface");
  updateCanvasControls(false);
  applyCanvasTransform();

  window.requestAnimationFrame(() => {
    if (resetView) {
      centerCanvas();
    }
    scheduleLinkRender();
  });
};

const renderMap = (mapData) => {
  elements.mapSummary.textContent = mapData.summary;
  renderMetrics(mapData.stats);
  renderMindmap(mapData, { preservePositions: false, resetView: true });
  elements.markdownOutput.value = buildMarkdown(mapData);
};

const renderPrompts = (prompts) => {
  elements.systemPrompt.value = prompts.system;
  elements.userPrompt.value = prompts.user;
  elements.refinePrompt.value = prompts.refine;
  elements.schemaPrompt.value = prompts.schema;
};

const generate = () => {
  const formData = collectFormData();

  if (!formData.transcript) {
    elements.mapSummary.textContent = "需要先提供课程字幕稿、课堂笔记或课程大纲，才能继续生成结构化导图。";
    elements.metrics.innerHTML = "";
    elements.markdownOutput.value = "";
    state.latestMap = null;
    state.nodePositions = {};
    state.latestPrompts = buildPrompts(formData, null);
    renderPrompts(state.latestPrompts);
    setCanvasEmpty("左侧还没有课程正文，先贴一点真实内容进来吧。");
    return;
  }

  const mapData = buildCourseMap(formData);
  const prompts = buildPrompts(formData, mapData);

  state.latestMap = mapData;
  state.latestPrompts = prompts;
  state.nodePositions = {};

  renderMap(mapData);
  renderPrompts(prompts);
};

const normalizeEditableValue = (path, rawValue) => {
  const compact = rawValue.replace(/\r/g, "");

  if (path.endsWith(".items")) {
    const items = compact
      .split("\n")
      .map((line) => line.replace(/^[•·\-\s]+/, "").trim())
      .filter(Boolean);
    return items.length ? items : ["待补充要点"];
  }

  const text = compact.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

  switch (path) {
    case "root.title":
      return text || "未命名课程";
    case "root.audience":
      return text || "通用学习者";
    case "root.goal":
      return text || "提炼课程结构并形成复习脑图";
    default:
      return text || "待补充";
  }
};

const updateMapFromEditable = (editable, { sanitizeDom = false } = {}) => {
  if (!state.latestMap) {
    return;
  }

  const path = editable.dataset.path;
  if (!path) {
    return;
  }

  const nextValue = normalizeEditableValue(path, editable.innerText);
  setMapValueByPath(state.latestMap, path, nextValue);

  if (sanitizeDom) {
    editable.textContent = Array.isArray(nextValue) ? nextValue.join("\n") : nextValue;
  }
};

const flashButton = (button, text) => {
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1200);
};

const fallbackCopy = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
};

const copyText = async (text, button) => {
  if (!text) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }
    if (button) {
      flashButton(button, "已复制");
    }
  } catch (error) {
    const copied = fallbackCopy(text);
    if (button) {
      flashButton(button, copied ? "已复制" : "复制失败");
    }
  }
};

const downloadFile = (fileName, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getSafeTitle = () =>
  (elements.title.value.trim() || "course-mindmap").replace(/[^\w\u4e00-\u9fa5-]+/g, "-");

const setActiveTab = (tabName) => {
  state.activePromptTab = tabName;
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  elements.panes.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.pane === tabName);
  });
};

const fillForm = (course) => {
  elements.title.value = course.title;
  elements.audience.value = course.audience;
  elements.goal.value = course.goal;
  elements.depth.value = course.depth;
  elements.transcript.value = course.transcript;
};

const clearForm = () => {
  elements.form.reset();
  elements.title.value = "";
  elements.audience.value = "";
  elements.goal.value = "";
  elements.depth.value = "标准版（平衡清晰度与信息量）";
  elements.transcript.value = "";
  generate();
};

const refreshPromptsOnly = debounce(() => {
  const formData = collectFormData();
  state.latestPrompts = buildPrompts(formData, state.latestMap);
  renderPrompts(state.latestPrompts);
}, 180);

const startCanvasPan = (event) => {
  state.interaction = {
    mode: "pan",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.canvas.x,
    originY: state.canvas.y,
  };
  elements.mindmap.setPointerCapture(event.pointerId);
  elements.mindmap.classList.add("is-panning");
};

const startNodeDrag = (event, nodeId) => {
  state.interaction = {
    mode: "node",
    pointerId: event.pointerId,
    nodeId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.nodePositions[nodeId].x,
    originY: state.nodePositions[nodeId].y,
  };
  elements.mindmap.setPointerCapture(event.pointerId);
  elements.mindmap.classList.add("is-dragging-node");
  elements.canvasSurface?.querySelector(`[data-node="${nodeId}"]`)?.classList.add("is-dragging");
};

const endPointerInteraction = () => {
  if (state.interaction?.mode === "node") {
    elements.canvasSurface
      ?.querySelector(`[data-node="${state.interaction.nodeId}"]`)
      ?.classList.remove("is-dragging");
  }

  elements.mindmap.classList.remove("is-panning", "is-dragging-node");
  state.interaction = null;
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  generate();
});

elements.loadSample.addEventListener("click", () => {
  fillForm(sampleCourse);
  generate();
});

elements.clearForm.addEventListener("click", clearForm);

elements.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

elements.copyActivePrompt.addEventListener("click", () => {
  const currentPane = elements.panes.find((pane) => pane.dataset.pane === state.activePromptTab);
  const textarea = currentPane?.querySelector("textarea");
  copyText(textarea?.value || "", elements.copyActivePrompt);
});

elements.copyTargets.forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(`#${button.dataset.copyTarget}`);
    copyText(target?.value || "", button);
  });
});

elements.downloadJson.addEventListener("click", () => {
  if (!state.latestMap) {
    return;
  }
  downloadFile(
    `${getSafeTitle()}-mindmap.json`,
    JSON.stringify(state.latestMap, null, 2),
    "application/json"
  );
});

elements.downloadMarkdown.addEventListener("click", () => {
  if (!elements.markdownOutput.value) {
    return;
  }
  downloadFile(`${getSafeTitle()}-mindmap.md`, elements.markdownOutput.value, "text/markdown");
});

elements.zoomIn.addEventListener("click", () => {
  const rect = elements.mindmap.getBoundingClientRect();
  zoomCanvas(1.12, rect.width / 2, rect.height / 2);
});

elements.zoomOut.addEventListener("click", () => {
  const rect = elements.mindmap.getBoundingClientRect();
  zoomCanvas(0.88, rect.width / 2, rect.height / 2);
});

elements.zoomReset.addEventListener("click", centerCanvas);

elements.relayoutMap.addEventListener("click", () => {
  if (!state.latestMap) {
    return;
  }
  state.nodePositions = {};
  renderMindmap(state.latestMap, { preservePositions: false, resetView: true });
});

elements.mindmap.addEventListener("pointerdown", (event) => {
  if (!state.graph) {
    return;
  }

  const handle = event.target.closest("[data-drag-handle]");
  if (handle) {
    event.preventDefault();
    const node = handle.closest("[data-node]");
    if (node) {
      startNodeDrag(event, node.dataset.node);
    }
    return;
  }

  if (event.target.closest('[contenteditable="true"]') || event.target.closest("[data-node]")) {
    return;
  }

  startCanvasPan(event);
});

elements.mindmap.addEventListener("pointermove", (event) => {
  if (!state.interaction) {
    return;
  }

  if (state.interaction.mode === "pan") {
    state.canvas.x = state.interaction.originX + (event.clientX - state.interaction.startX);
    state.canvas.y = state.interaction.originY + (event.clientY - state.interaction.startY);
    applyCanvasTransform();
    return;
  }

  if (state.interaction.mode === "node") {
    state.nodePositions[state.interaction.nodeId] = {
      x: state.interaction.originX + (event.clientX - state.interaction.startX) / state.canvas.scale,
      y: state.interaction.originY + (event.clientY - state.interaction.startY) / state.canvas.scale,
    };
    applyNodePosition(state.interaction.nodeId);
    scheduleLinkRender();
  }
});

elements.mindmap.addEventListener("pointerup", endPointerInteraction);
elements.mindmap.addEventListener("pointercancel", endPointerInteraction);

elements.mindmap.addEventListener(
  "wheel",
  (event) => {
    if (!state.graph) {
      return;
    }

    event.preventDefault();
    const rect = elements.mindmap.getBoundingClientRect();
    zoomCanvas(event.deltaY < 0 ? 1.08 : 0.92, event.clientX - rect.left, event.clientY - rect.top);
  },
  { passive: false }
);

elements.mindmap.addEventListener("input", (event) => {
  const editable = event.target.closest('[contenteditable="true"][data-path]');
  if (!editable) {
    return;
  }

  updateMapFromEditable(editable);
  syncDerivedOutputs();
  scheduleLinkRender();
});

elements.mindmap.addEventListener("blur", (event) => {
  const editable = event.target.closest('[contenteditable="true"][data-path]');
  if (!editable) {
    return;
  }

  updateMapFromEditable(editable, { sanitizeDom: true });
  syncDerivedOutputs();
  scheduleLinkRender();
}, true);

elements.mindmap.addEventListener("paste", (event) => {
  const editable = event.target.closest('[contenteditable="true"]');
  if (!editable) {
    return;
  }

  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
});

[elements.title, elements.audience, elements.goal, elements.depth, elements.transcript].forEach((input) => {
  input.addEventListener("input", refreshPromptsOnly);
});

window.addEventListener("resize", () => {
  updateZoomLevel();
  scheduleLinkRender();
});

fillForm(sampleCourse);
setActiveTab("system");
generate();
