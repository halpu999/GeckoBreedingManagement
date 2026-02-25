/**
 * GeckoBreedingManagement - メインアプリケーション
 * レオパードゲッコー 繁殖管理
 */

// ====== 状態管理 ======
const state = {
  parent1: {},  // { morphId: status }
  parent2: {},
  currentParent: null,
  currentMorphForHet: null,
  guideFilter: 'all',
  eventFilter: 'all',
  knowledgeFilter: 'all',
  breedingRecords: JSON.parse(localStorage.getItem('breedingRecords') || '[]'),
};

// 遺伝計算エンジンの初期化
const engine = new GeneticsEngine(MORPH_DATABASE);

// ====== 初期化 ======
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderEvents();
  renderMorphGuide();
  renderComboList();
  renderReverseSelector();
  renderKnowledge();
  renderKnowledgeFilters();
  renderBreedingRecords();
  checkBreedingAlerts();
});

// ====== タブ制御 ======
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // タブボタンの切り替え
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // コンテンツの切り替え
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`content-${tabId}`).classList.add('active');
    });
  });
}

// ====== モルフセレクター ======
function openMorphSelector(parentNum) {
  state.currentParent = parentNum;
  const modal = document.getElementById('morph-modal');
  const title = document.getElementById('modal-title');
  title.textContent = `モルフを追加 - ${parentNum === 1 ? 'オス ♂' : 'メス ♀'}`;

  renderModalMorphList();
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // 検索フィールドをクリア
  document.getElementById('modal-morph-search').value = '';
}

function closeMorphSelector() {
  document.getElementById('morph-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function renderModalMorphList(searchQuery = '') {
  const container = document.getElementById('modal-morph-list');
  const parentData = state.currentParent === 1 ? state.parent1 : state.parent2;
  const query = searchQuery.toLowerCase();

  // グループ分け
  const groups = [
    { title: '劣性遺伝 (Recessive)', type: 'recessive' },
    { title: '優性遺伝 (Dominant)', type: 'dominant' },
    { title: '共優性 (Co-dominant)', type: 'codominant' },
  ];

  let html = '';

  for (const group of groups) {
    const morphs = Object.values(MORPH_DATABASE).filter(m => m.type === group.type);
    const filtered = morphs.filter(m => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query)
        || m.japaneseName.includes(query)
        || m.id.toLowerCase().includes(query);
    });

    if (filtered.length === 0) continue;

    html += `<div class="morph-select-group">`;
    html += `<div class="morph-select-group-title">${group.title}</div>`;

    for (const morph of filtered) {
      const isSelected = parentData[morph.id] && parentData[morph.id] !== 'wild';
      const typeLabels = { recessive: '劣性', dominant: '優性', codominant: '共優性' };

      html += `
        <div class="morph-select-item ${isSelected ? 'disabled' : ''}" 
             onclick="${isSelected ? '' : `selectMorph('${morph.id}')`}">
          <div class="morph-dot" style="background: ${morph.color}"></div>
          <div class="morph-select-info">
            <div class="morph-select-name">${morph.name}</div>
            <div class="morph-select-jp">${morph.japaneseName}</div>
            ${morph.healthWarning ? `<div class="morph-select-warning">${morph.healthWarning.substring(0, 40)}...</div>` : ''}
          </div>
          <span class="morph-select-type">${typeLabels[morph.type]}</span>
        </div>
      `;
    }
    html += `</div>`;
  }

  if (!html) {
    html = '<p style="text-align:center;color:var(--text-tertiary);padding:20px;">該当するモルフが見つかりません</p>';
  }

  container.innerHTML = html;
}

function filterModalMorphs() {
  const query = document.getElementById('modal-morph-search').value;
  renderModalMorphList(query);
}

// ====== モルフ選択 ======
function selectMorph(morphId) {
  const morph = MORPH_DATABASE[morphId];
  state.currentMorphForHet = morphId;

  // モルフのタイプに応じてhet選択モーダルを表示
  if (morph.type === 'recessive') {
    showHetOptions(morphId, [
      { status: 'homozygous', label: `${morph.name}（ホモ接合体）`, desc: 'ビジュアル表現 - 両親から遺伝子を1つずつ受け継いだ' },
      { status: 'heterozygous', label: `100% het ${morph.name}`, desc: 'ヘテロ - 遺伝子を1つ持つキャリア（外見には現れない）' },
      { status: 'possible_het', label: `Possible het ${morph.name}`, desc: '50%の確率でhetである可能性がある' },
    ]);
  } else if (morph.type === 'dominant') {
    showHetOptions(morphId, [
      { status: 'homozygous', label: `${morph.name}（ホモ）`, desc: '遺伝子を2つ持つ（ホモ接合体）' },
      { status: 'heterozygous', label: `${morph.name}（ヘテロ）`, desc: '遺伝子を1つ持つ（通常の表現）' },
    ]);
  } else if (morph.type === 'codominant') {
    showHetOptions(morphId, [
      { status: 'super', label: `${morph.superForm || 'Super ' + morph.name}（スーパー体）`, desc: '遺伝子を2つ持つ（ホモ接合体 = スーパー体）' },
      { status: 'homozygous', label: `${morph.name}`, desc: '遺伝子を1つ持つ（ヘテロ接合体）' },
    ]);
  }
}

function showHetOptions(morphId, options) {
  closeMorphSelector();

  const modal = document.getElementById('het-modal');
  const morph = MORPH_DATABASE[morphId];
  const title = document.getElementById('het-modal-title');
  title.textContent = `${morph.japaneseName} - 遺伝子型を選択`;

  const container = document.getElementById('het-options');
  container.innerHTML = options.map(opt => `
    <button class="het-option-btn" onclick="confirmMorphSelection('${morphId}', '${opt.status}')">
      <span class="het-label">${opt.label}</span>
      <span class="het-desc">${opt.desc}</span>
    </button>
  `).join('');

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeHetModal() {
  document.getElementById('het-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function confirmMorphSelection(morphId, status) {
  const parentData = state.currentParent === 1 ? state.parent1 : state.parent2;
  parentData[morphId] = status;

  closeHetModal();
  renderParentMorphs(state.currentParent);

  // 結果セクションを非表示（再計算が必要）
  document.getElementById('results-section').style.display = 'none';
}

// ====== 親モルフの表示 ======
function renderParentMorphs(parentNum) {
  const container = document.getElementById(`parent${parentNum}-morphs`);
  const parentData = parentNum === 1 ? state.parent1 : state.parent2;

  const activeMorphs = Object.entries(parentData).filter(([_, status]) => status !== 'wild');

  if (activeMorphs.length === 0) {
    container.innerHTML = '<p class="empty-text">モルフを追加してください</p>';
    return;
  }

  container.innerHTML = activeMorphs.map(([morphId, status]) => {
    const morph = MORPH_DATABASE[morphId];
    const chipClass = getChipClass(morph, status);
    const statusText = getStatusText(morph, status);

    return `
      <div class="morph-chip ${chipClass}">
        <span>${morph.japaneseName}</span>
        ${statusText ? `<span class="chip-status">${statusText}</span>` : ''}
        <button class="chip-remove" onclick="removeMorph(${parentNum}, '${morphId}')" title="削除">✕</button>
      </div>
    `;
  }).join('');
}

function getChipClass(morph, status) {
  if (morph.type === 'codominant' && status === 'super') return 'super';
  if (morph.type === 'codominant') return 'codominant';
  if (morph.type === 'dominant') return 'dominant';
  if (status === 'heterozygous' && morph.type === 'recessive') return 'het';
  if (status === 'possible_het') return 'possible-het';
  return '';
}

function getStatusText(morph, status) {
  if (morph.type === 'recessive') {
    switch (status) {
      case 'homozygous': return 'ビジュアル';
      case 'heterozygous': return '100% het';
      case 'possible_het': return 'pos. het';
    }
  }
  if (morph.type === 'dominant') {
    switch (status) {
      case 'homozygous': return 'ホモ';
      case 'heterozygous': return 'ヘテロ';
    }
  }
  if (morph.type === 'codominant') {
    switch (status) {
      case 'super': return 'スーパー';
      case 'homozygous': return '';
    }
  }
  return '';
}

function removeMorph(parentNum, morphId) {
  const parentData = parentNum === 1 ? state.parent1 : state.parent2;
  delete parentData[morphId];
  renderParentMorphs(parentNum);

  // 結果セクションを非表示
  document.getElementById('results-section').style.display = 'none';
}

// ====== 計算実行 ======
function calculateResults() {
  // 既存のエラーメッセージを削除
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();

  // 入力チェック
  const p1Active = Object.entries(state.parent1).filter(([_, s]) => s !== 'wild').length;
  const p2Active = Object.entries(state.parent2).filter(([_, s]) => s !== 'wild').length;

  if (p1Active === 0 && p2Active === 0) {
    showError('両親のモルフを少なくとも1つ追加してください。');
    return;
  }

  // ボタンアニメーション
  const btn = document.getElementById('calculate-btn');
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => btn.style.transform = '', 150);

  // 計算実行
  const result = engine.calculate(state.parent1, state.parent2);

  if (result.error) {
    showError(result.error);
    return;
  }

  renderResults(result.results);
}

function showError(message) {
  // 既存のエラーメッセージを削除
  const existingError = document.querySelector('.error-message');
  if (existingError) existingError.remove();

  const container = document.querySelector('.calculator-container');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <span class="error-icon">⚠️</span>
    <span>${message}</span>
  `;
  container.appendChild(errorDiv);

  // 自動削除
  setTimeout(() => errorDiv.remove(), 5000);
}

function renderResults(results) {
  const section = document.getElementById('results-section');
  const grid = document.getElementById('results-grid');

  if (results.length === 0) {
    grid.innerHTML = `
      <div class="result-card" style="animation-delay: 0s; opacity: 1; transform: none;">
        <div class="result-info">
          <div class="result-name">Normal (ノーマル)</div>
          <div class="result-details">すべて野生型の子個体が生まれます</div>
        </div>
        <div class="result-probability high">100%</div>
      </div>
    `;
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  grid.innerHTML = results.map((r, i) => {
    const probClass = r.probability >= 25 ? 'high' : '';
    const warnings = getResultWarnings(r.traits);
    const details = r.traits
      .filter(t => t.status !== 'wild')
      .map(t => {
        const morph = MORPH_DATABASE[t.locus];
        return `${morph?.japaneseName || t.locus}: ${t.phenotype}`;
      }).join(' / ');

    return `
      <div class="result-card" style="animation-delay: ${i * 0.08}s">
        <div class="result-probability ${probClass}">${r.probability}%</div>
        <div class="result-info">
          <div class="result-name">${r.displayName}</div>
          ${details ? `<div class="result-details">${details}</div>` : ''}
          ${warnings.map(w => `<div class="result-warning">⚠️ ${w}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  section.style.display = 'block';
  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function getResultWarnings(traits) {
  const warnings = [];
  for (const t of traits) {
    if (t.status === 'wild') continue;
    const morph = MORPH_DATABASE[t.locus];
    if (morph?.healthWarning) {
      if (morph.type === 'dominant' && (t.status === 'heterozygous' || t.status === 'homozygous')) {
        warnings.push(morph.healthWarning.replace('⚠️ ', ''));
      }
      if (morph.type === 'recessive' && t.status === 'homozygous') {
        warnings.push(morph.healthWarning.replace('⚠️ ', ''));
      }
    }
  }
  return warnings;
}

// ====== モルフ図鑑 ======
function renderMorphGuide() {
  const container = document.getElementById('morph-list');
  const query = (document.getElementById('morph-search')?.value || '').toLowerCase();
  const filter = state.guideFilter;

  let allMorphs = [];

  // 遺伝的モルフ
  for (const morph of Object.values(MORPH_DATABASE)) {
    if (filter !== 'all' && morph.type !== filter) continue;
    if (query && !morph.name.toLowerCase().includes(query) && !morph.japaneseName.includes(query)) continue;

    allMorphs.push({
      ...morph,
      isPolygenic: false,
    });
  }

  // ポリジェニック
  if (filter === 'all' || filter === 'polygenic') {
    for (const trait of POLYGENIC_TRAITS) {
      if (query && !trait.name.toLowerCase().includes(query) && !trait.japaneseName.includes(query)) continue;

      allMorphs.push({
        id: trait.id,
        name: trait.name,
        japaneseName: trait.japaneseName,
        type: 'polygenic',
        description: trait.description,
        healthWarning: null,
        ethicalConcern: null,
        color: trait.color || '#A569BD',
        image: trait.image,
        isPolygenic: true,
      });
    }

    // ブリーディングプロジェクト
    if (typeof BREEDING_PROJECTS !== 'undefined') {
      for (const proj of BREEDING_PROJECTS) {
        if (query && !proj.name.toLowerCase().includes(query) && !proj.japaneseName.includes(query)) continue;

        allMorphs.push({
          id: proj.id,
          name: proj.name,
          japaneseName: proj.japaneseName,
          type: 'polygenic',
          description: `${proj.description}\n\n🧬 構成: ${proj.genetics}\n📌 状態: ${proj.status}`,
          healthWarning: null,
          ethicalConcern: null,
          color: proj.color || '#A569BD',
          image: proj.image,
          isPolygenic: true,
        });
      }
    }
  }

  const typeLabels = {
    recessive: '劣性',
    dominant: '優性',
    codominant: '共優性',
    polygenic: 'ポリジェニック',
  };

  container.innerHTML = allMorphs.map(morph => `
    <div class="guide-card ${morph.ethicalConcern === 'high' ? 'ethical-high' : morph.ethicalConcern === 'moderate' ? 'ethical-moderate' : ''}" onclick="this.classList.toggle('expanded')">
      <div class="guide-card-header">
        <div class="guide-color-dot" style="background: ${morph.color || '#A569BD'}"></div>
        ${morph.ethicalConcern ? '<span class="ethical-badge">⚠️</span>' : ''}
        <span class="guide-card-name">${morph.name}</span>
        <span class="guide-card-jp">${morph.japaneseName}</span>
        <span class="guide-card-type ${morph.type}">${typeLabels[morph.type]}</span>
      </div>
      <div class="guide-card-image-wrap">
        ${morph.image ? `
          <div class="guide-card-photo">
            <img src="${morph.image}" alt="${morph.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'guide-card-illustration\\' style=\\'background: linear-gradient(135deg, ${morph.color || '#A569BD'}22, ${morph.color || '#A569BD'}44);\\'><span class=\\'guide-fallback-label\\'>${morph.name}</span></div>'">
          </div>
        ` : `
          <div class="guide-card-illustration" style="background: linear-gradient(135deg, ${morph.color || '#A569BD'}22, ${morph.color || '#A569BD'}44);">
            <svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" class="gecko-silhouette">
              <defs>
                <linearGradient id="grad-${morph.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${morph.color || '#A569BD'};stop-opacity:0.6" />
                  <stop offset="100%" style="stop-color:${morph.color || '#A569BD'};stop-opacity:0.9" />
                </linearGradient>
              </defs>
              <path d="M45 25C30 20 20 30 25 40C20 42 15 38 12 42C10 46 14 48 18 47C16 50 13 48 10 50C8 54 12 56 16 54C20 52 22 50 25 48C28 55 35 58 42 56C45 55 48 52 50 48C55 55 62 58 68 56C72 54 75 50 76 45C80 50 85 52 90 50C92 48 90 44 86 44C90 42 94 40 92 36C88 32 82 35 80 38C78 30 72 25 65 25C58 25 52 28 50 35C48 28 45 25 45 25Z" fill="url(#grad-${morph.id})" opacity="0.5"/>
              <text x="100" y="50" text-anchor="middle" fill="${morph.color || '#A569BD'}" font-size="14" font-weight="700" font-family="'Inter', sans-serif" opacity="0.8">${morph.name}</text>
            </svg>
          </div>
        `}
      </div>
      <div class="guide-card-desc">${morph.description || ''}</div>
      ${morph.healthWarning ? `<div class="guide-card-warning">${morph.healthWarning}</div>` : ''}
    </div>
  `).join('');

  if (allMorphs.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:30px;">該当するモルフが見つかりません</p>';
  }
}

function filterMorphGuide() {
  renderMorphGuide();
}

function handleSearch(query) {
  state.searchQuery = query.toLowerCase().trim();
  renderMorphGuide();
}

function setGuideFilter(filter) {
  state.guideFilter = filter;
  document.querySelectorAll('.filter-pills .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.filter === filter);
  });
  renderMorphGuide();
}

function expandAllMorphs() {
  document.querySelectorAll('.guide-card').forEach(c => c.classList.add('expanded'));
}

function collapseAllMorphs() {
  document.querySelectorAll('.guide-card').forEach(c => c.classList.remove('expanded'));
}

// ====== 逆計算機能 ======
function renderReverseSelector() {
  const container = document.getElementById('reverse-combo-select');
  if (!container) return;

  container.innerHTML = `<option value="">コンボモルフを選択...</option>` +
    COMBINATION_MORPHS.map(combo =>
      `<option value="${combo.id}">${combo.name}（${combo.japaneseName}）</option>`
    ).join('');
}

function reverseCalc(comboId) {
  const resultContainer = document.getElementById('reverse-result');
  if (!comboId) {
    resultContainer.innerHTML = '<p class="reverse-placeholder">上のリストからコンボモルフを選択すると、必要な親の組み合わせが表示されます。</p>';
    return;
  }

  const combo = COMBINATION_MORPHS.find(c => c.id === comboId);
  if (!combo) return;

  // 必要な遺伝子を分類
  const recessiveGenes = [];
  const dominantGenes = [];
  const codominantGenes = [];
  const polygenicNeeded = [];

  for (const compId of combo.components) {
    const morph = MORPH_DATABASE[compId];
    if (!morph) continue;
    if (morph.type === 'recessive') recessiveGenes.push(morph);
    else if (morph.type === 'dominant') dominantGenes.push(morph);
    else if (morph.type === 'codominant') codominantGenes.push(morph);
  }

  for (const pId of (combo.polygenicComponents || [])) {
    const trait = POLYGENIC_TRAITS.find(t => t.id === pId);
    if (trait) polygenicNeeded.push(trait);
  }

  // ペアリングパターンを生成
  let patternsHtml = '';

  // パターン1: 最速ルート（両親ともビジュアル）
  patternsHtml += `
    <div class="reverse-pattern">
      <div class="reverse-pattern-header">
        <span class="pattern-badge best">最速</span>
        <span class="pattern-title">パターン1: 両親ともビジュアル</span>
      </div>
      <div class="reverse-pattern-desc">100%の確率で目的のコンボが出現</div>
      <div class="reverse-parents">
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♂ オス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag recessive">${m.japaneseName}（ビジュアル）</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
          ${polygenicNeeded.map(t => `<span class="reverse-gene-tag polygenic">${t.japaneseName}</span>`).join('')}
        </div>
        <div class="reverse-cross">×</div>
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♀ メス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag recessive">${m.japaneseName}（ビジュアル）</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
          ${polygenicNeeded.map(t => `<span class="reverse-gene-tag polygenic">${t.japaneseName}</span>`).join('')}
        </div>
      </div>
      <div class="reverse-result-prob">出現確率: <strong>${dominantGenes.length > 0 ? '~75%' : codominantGenes.length > 0 ? '~25-50%' : '100%'}</strong></div>
    </div>`;

  // パターン2: het同士（劣性遺伝子がある場合）
  if (recessiveGenes.length > 0) {
    const prob = Math.pow(0.25, recessiveGenes.length) * 100;
    patternsHtml += `
    <div class="reverse-pattern">
      <div class="reverse-pattern-header">
        <span class="pattern-badge">入手しやすい</span>
        <span class="pattern-title">パターン2: het同士のペアリング</span>
      </div>
      <div class="reverse-pattern-desc">hetキャリア同士の交配。出現確率は低いが親個体が入手しやすい</div>
      <div class="reverse-parents">
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♂ オス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag het">100% het ${m.japaneseName}</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
        </div>
        <div class="reverse-cross">×</div>
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♀ メス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag het">100% het ${m.japaneseName}</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
        </div>
      </div>
      <div class="reverse-result-prob">出現確率: <strong>~${prob.toFixed(prob < 1 ? 2 : 1)}%</strong></div>
    </div>`;

    // パターン3: ビジュアル × het
    patternsHtml += `
    <div class="reverse-pattern">
      <div class="reverse-pattern-header">
        <span class="pattern-badge">バランス</span>
        <span class="pattern-title">パターン3: ビジュアル × het</span>
      </div>
      <div class="reverse-pattern-desc">片親がビジュアル、もう片方がhetキャリア</div>
      <div class="reverse-parents">
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♂ オス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag recessive">${m.japaneseName}（ビジュアル）</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
        </div>
        <div class="reverse-cross">×</div>
        <div class="reverse-parent-card">
          <div class="reverse-parent-label">♀ メス</div>
          ${recessiveGenes.map(m => `<span class="reverse-gene-tag het">100% het ${m.japaneseName}</span>`).join('')}
          ${dominantGenes.map(m => `<span class="reverse-gene-tag dominant">${m.japaneseName}</span>`).join('')}
          ${codominantGenes.map(m => `<span class="reverse-gene-tag codominant">${m.japaneseName}</span>`).join('')}
        </div>
      </div>
      <div class="reverse-result-prob">出現確率: <strong>~${(Math.pow(0.5, recessiveGenes.length) * 100).toFixed(1)}%</strong></div>
    </div>`;
  }

  // 注意事項
  let notesHtml = '';
  if (combo.note) {
    notesHtml += `<div class="reverse-note">📝 ${combo.note}</div>`;
  }
  if (dominantGenes.length > 0) {
    notesHtml += `<div class="reverse-note">⚠️ 優性遺伝子（${dominantGenes.map(m => m.japaneseName).join('、')}）はhetで保持できないため、片親がビジュアルである必要があります。</div>`;
  }
  if (polygenicNeeded.length > 0) {
    notesHtml += `<div class="reverse-note">🧬 ポリジェニック形質（${polygenicNeeded.map(t => t.japaneseName).join('、')}）は選別交配で強化する必要があります。</div>`;
  }

  // アルビノ非互換チェック
  const albinoTypes = recessiveGenes.filter(m => m.albinoGroup).map(m => m.albinoGroup);
  if (albinoTypes.length > 1) {
    notesHtml += `<div class="reverse-note">⚠️ 複数のアルビノ系統が含まれています。アルビノ系統は互いに互換性がないため注意してください。</div>`;
  }

  resultContainer.innerHTML = `
    <div class="reverse-combo-info">
      <h3 class="reverse-combo-name">${combo.name}（${combo.japaneseName}）</h3>
      <p class="reverse-combo-desc">${combo.description}</p>
      <div class="reverse-genes-needed">
        <span class="reverse-label">必要な遺伝子:</span>
        ${combo.components.map(c => {
    const m = MORPH_DATABASE[c];
    return `<span class="reverse-gene-tag ${m?.type || ''}">${m?.japaneseName || c}</span>`;
  }).join('')}
        ${polygenicNeeded.map(t => `<span class="reverse-gene-tag polygenic">${t.japaneseName}</span>`).join('')}
      </div>
    </div>
    <h4 class="reverse-patterns-title">🔄 推奨ペアリングパターン</h4>
    ${patternsHtml}
    ${notesHtml}
    <button class="combo-card-btn reverse-try-btn" onclick="loadComboToCalculator('${combo.id}')">
      🧮 この組み合わせで計算してみる →
    </button>
  `;
}

// ====== コンボリスト ======
function renderComboList() {
  const container = document.getElementById('combo-list');

  container.innerHTML = COMBINATION_MORPHS.map(combo => {
    const geneticMorphTags = combo.components.map(c => {
      const morph = MORPH_DATABASE[c];
      return `<span class="combo-gene-tag">${morph?.japaneseName || c}</span>`;
    }).join('');

    const polygenicTags = (combo.polygenicComponents || []).map(p => {
      const trait = POLYGENIC_TRAITS.find(t => t.id === p);
      return `<span class="combo-gene-tag polygenic">${trait?.japaneseName || p}</span>`;
    }).join('');

    return `
      <div class="combo-card">
        <div class="combo-card-header">
          <div>
            <div class="combo-card-name">${combo.name}</div>
            <div class="combo-card-jp">${combo.japaneseName}</div>
          </div>
        </div>
        <div class="combo-card-desc">${combo.description}</div>
        <div class="combo-card-genes">
          ${geneticMorphTags}
          ${polygenicTags}
        </div>
        <button class="combo-card-btn" onclick="loadComboToCalculator('${combo.id}')">
          この組み合わせで計算する →
        </button>
      </div>
    `;
  }).join('');
}

function loadComboToCalculator(comboId) {
  const combo = COMBINATION_MORPHS.find(c => c.id === comboId);
  if (!combo) return;

  // 親1にコンボのすべての遺伝子をホモとしてセット
  state.parent1 = {};
  for (let morphId of combo.components) {
    let statusForCodominant = 'homozygous'; // 通常のコンボではヘテロ表現(Ss)

    // スーパー体の特例指定
    if (morphId === 'superSnow') {
      morphId = 'mackSnow';
      statusForCodominant = 'super'; // スーパー体(SS)
    } else if (morphId === 'superGiant') {
      morphId = 'giant';
      statusForCodominant = 'super'; // スーパー体(SS)
    }

    const morph = MORPH_DATABASE[morphId];
    if (!morph) {
      console.warn(`Unknown morph component: ${morphId}`);
      continue;
    }

    if (morph.type === 'recessive') {
      state.parent1[morphId] = 'homozygous';
    } else if (morph.type === 'dominant') {
      state.parent1[morphId] = 'heterozygous'; // 単一の優性遺伝子は通常ヘテロで表現
    } else if (morph.type === 'codominant') {
      state.parent1[morphId] = statusForCodominant;
    }
  }

  // 親2はノーマル
  state.parent2 = {};

  renderParentMorphs(1);
  renderParentMorphs(2);

  // 計算機タブに切り替え
  document.querySelector('[data-tab="calculator"]').click();

  // 結果をリセット
  document.getElementById('results-section').style.display = 'none';

  // スクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====== イベント表示 ======
function renderEvents() {
  const container = document.getElementById('event-list');
  if (!container) return;
  const filter = state.eventFilter;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let events = REPTILE_EVENTS.filter(e => {
    const eEnd = e.dateEnd ? new Date(e.dateEnd) : new Date(e.date);
    // 終了済みイベントは非表示
    if (eEnd < today) return false;
    // 地域フィルタ
    if (filter === 'all') return true;
    if (filter === 'kanto') return e.region === '関東';
    if (filter === 'kansai') return e.region === '関西';
    if (filter === 'chubu') return e.region === '中部';
    return !['関東', '関西', '中部'].includes(e.region);
  });

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = events.map(evt => {
    const eDate = new Date(evt.date);
    const eEnd = evt.dateEnd ? new Date(evt.dateEnd) : eDate;
    const isPast = eEnd < today;
    const isToday = eDate <= today && today <= eEnd;
    const isSoon = !isPast && !isToday && (eDate - today) <= 14 * 24 * 60 * 60 * 1000;
    const daysUntil = Math.ceil((eDate - today) / (1000 * 60 * 60 * 24));

    const dateStr = eDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    const dateEndStr = evt.dateEnd ? ' 〜 ' + new Date(evt.dateEnd).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }) : '';

    let statusBadge = '';
    if (isPast) statusBadge = '<span class="event-badge past">終了</span>';
    else if (isToday) statusBadge = '<span class="event-badge today">開催中！</span>';
    else if (isSoon) statusBadge = `<span class="event-badge soon">あと${daysUntil}日</span>`;
    else statusBadge = `<span class="event-badge future">あと${daysUntil}日</span>`;

    return `
        <div class="event-card ${isPast ? 'past' : ''} ${isToday ? 'today' : ''} ${isSoon ? 'soon' : ''}">
          <div class="event-card-icon">${evt.icon}</div>
          <div class="event-card-body">
            <div class="event-card-header">
              <span class="event-card-name">${evt.name}</span>
              ${statusBadge}
            </div>
            <div class="event-card-date">📅 ${dateStr}${dateEndStr}</div>
            <div class="event-card-venue">📍 ${evt.venue} (${evt.area})</div>
            <div class="event-card-desc">${evt.description}</div>
            ${evt.url ? `<a href="${evt.url}" target="_blank" class="event-card-link">🔗 公式サイト</a>` : ''}
          </div>
        </div>`;
  }).join('');

  if (events.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:30px;">該当するイベントがありません</p>';
  }
}

function setEventFilter(filter) {
  state.eventFilter = filter;
  document.querySelectorAll('.event-filter-pills .pill').forEach(p => {
    const region = p.dataset.region;
    p.classList.toggle('active', region === filter);
  });
  renderEvents();
}

// ====== 豆知識 ======
const KNOWLEDGE_CATEGORIES = [
  { id: 'all', label: 'すべて', icon: '📋' },
  { id: '初心者向け', label: '初心者向け', icon: '🌱' },
  { id: '健康管理', label: '健康管理', icon: '🏥' },
  { id: '繁殖知識', label: '繁殖知識', icon: '🥚' },
  { id: 'モルフ知識', label: 'モルフ知識', icon: '🧬' },
  { id: '飼育Tips', label: '飼育Tips', icon: '💡' },
];
function renderKnowledgeFilters() {
  const container = document.getElementById('knowledge-category-filter');
  if (!container) return;
  container.innerHTML = KNOWLEDGE_CATEGORIES.map(cat =>
    `<button class="pill ${cat.id === 'all' ? 'active' : ''}" data-cat="${cat.id}" onclick="setKnowledgeFilter('${cat.id}')">${cat.icon} ${cat.label}</button>`
  ).join('');
}

function renderKnowledge() {
  const container = document.getElementById('knowledge-list');
  if (!container) return;
  const filter = state.knowledgeFilter;

  const items = GECKO_KNOWLEDGE.filter(k => filter === 'all' || k.category === filter);

  container.innerHTML = items.map(item => `
    <div class="knowledge-card" onclick="this.classList.toggle('expanded')">
      <div class="knowledge-card-header">
        <span class="knowledge-icon">${item.icon}</span>
        <div class="knowledge-card-info">
          <span class="knowledge-card-title">${item.title}</span>
          <span class="knowledge-card-cat">${item.category}</span>
        </div>
        <span class="knowledge-expand-icon">▼</span>
      </div>
      <div class="knowledge-card-body">
        <p class="knowledge-content">${item.content}</p>
        ${item.tips ? `
          <div class="knowledge-tips">
            <strong>💡 ポイント:</strong>
            <ul>${item.tips.map(t => `<li>${t}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function setKnowledgeFilter(filter) {
  state.knowledgeFilter = filter;
  document.querySelectorAll('#knowledge-category-filter .pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === filter);
  });
  renderKnowledge();
}

// ====== 繁殖管理 ======
function openBreedingModal() {
  const modal = document.getElementById('breeding-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // 今日の日付をデフォルト
  document.getElementById('breed-mating-date').value = new Date().toISOString().split('T')[0];
}

function closeBreedingModal() {
  document.getElementById('breeding-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function saveBreedingRecord() {
  const pairName = document.getElementById('breed-pair-name').value || '無名ペア';
  const matingDate = document.getElementById('breed-mating-date').value;
  const temp = parseFloat(document.getElementById('breed-incubation-temp').value) || 29;
  const memo = document.getElementById('breed-memo').value;

  if (!matingDate) {
    alert('交尾日を入力してください。');
    return;
  }

  const record = {
    id: Date.now().toString(),
    pairName,
    matingDate,
    incubationTemp: temp,
    memo,
    eggLaidDate: null,
    status: 'mating', // mating, egg_laid, hatched
    createdAt: new Date().toISOString(),
  };

  state.breedingRecords.push(record);
  localStorage.setItem('breedingRecords', JSON.stringify(state.breedingRecords));

  closeBreedingModal();
  renderBreedingRecords();
}

function recordEggLaid(recordId) {
  const record = state.breedingRecords.find(r => r.id === recordId);
  if (!record) return;
  const eggDate = prompt('産卵日を入力 (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
  if (!eggDate) return;
  record.eggLaidDate = eggDate;
  record.status = 'egg_laid';
  localStorage.setItem('breedingRecords', JSON.stringify(state.breedingRecords));
  renderBreedingRecords();
}

function recordHatched(recordId) {
  const record = state.breedingRecords.find(r => r.id === recordId);
  if (!record) return;
  record.status = 'hatched';
  record.hatchDate = new Date().toISOString().split('T')[0];
  localStorage.setItem('breedingRecords', JSON.stringify(state.breedingRecords));
  renderBreedingRecords();
}

function deleteBreedingRecord(recordId) {
  if (!confirm('この繁殖記録を削除しますか？')) return;
  state.breedingRecords = state.breedingRecords.filter(r => r.id !== recordId);
  localStorage.setItem('breedingRecords', JSON.stringify(state.breedingRecords));
  renderBreedingRecords();
}

function renderBreedingRecords() {
  const container = document.getElementById('breeding-records');
  if (!container) return;

  if (state.breedingRecords.length === 0) {
    container.innerHTML = '<p class="empty-text">繁殖記録がありません。上のボタンから追加してください。</p>';
    return;
  }

  // 新しい順
  const sorted = [...state.breedingRecords].reverse();

  container.innerHTML = sorted.map(rec => {
    const mDate = new Date(rec.matingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 産卵予定: 交尾後 14〜28日
    const eggMinDate = new Date(mDate);
    eggMinDate.setDate(eggMinDate.getDate() + 14);
    const eggMaxDate = new Date(mDate);
    eggMaxDate.setDate(eggMaxDate.getDate() + 28);

    // ハッチ予定: 産卵後 温度に基づく日数計算
    let hatchMinDays = 45, hatchMaxDays = 70;
    if (rec.incubationTemp >= 31) { hatchMinDays = 35; hatchMaxDays = 50; }
    else if (rec.incubationTemp >= 29) { hatchMinDays = 45; hatchMaxDays = 55; }
    else if (rec.incubationTemp >= 27) { hatchMinDays = 55; hatchMaxDays = 65; }
    else { hatchMinDays = 60; hatchMaxDays = 70; }

    // TSD性別予測
    let tsdPrediction = '♂♀ 半々';
    if (rec.incubationTemp >= 31.5) tsdPrediction = '♂ オス寄り (80%+)';
    else if (rec.incubationTemp >= 30) tsdPrediction = '♂ オスやや多い';
    else if (rec.incubationTemp <= 27) tsdPrediction = '♀ メス寄り (80%+)';
    else if (rec.incubationTemp <= 28.5) tsdPrediction = '♀ メスやや多い';

    let statusHtml = '';
    let timelineHtml = '';

    if (rec.status === 'mating') {
      const eggDaysLeft = Math.ceil((eggMinDate - today) / (1000 * 60 * 60 * 24));
      statusHtml = `<span class="breed-status mating">🔴 交尾済み</span>`;
      timelineHtml = `
              <div class="breed-timeline">
                <div class="breed-timeline-item">
                  <span class="tl-label">🥚 産卵予定</span>
                  <span class="tl-date">${eggMinDate.toLocaleDateString('ja-JP')} 〜 ${eggMaxDate.toLocaleDateString('ja-JP')}</span>
                  ${eggDaysLeft > 0 ? `<span class="tl-countdown">あと約${eggDaysLeft}〜${eggDaysLeft + 14}日</span>` : `<span class="tl-countdown soon">産卵の可能性あり！</span>`}
                </div>
              </div>
              <button class="breed-action-btn" onclick="recordEggLaid('${rec.id}')">🥚 産卵を記録</button>
            `;
    } else if (rec.status === 'egg_laid') {
      const eggDate = new Date(rec.eggLaidDate);
      const hatchMinDate = new Date(eggDate);
      hatchMinDate.setDate(hatchMinDate.getDate() + hatchMinDays);
      const hatchMaxDate = new Date(eggDate);
      hatchMaxDate.setDate(hatchMaxDate.getDate() + hatchMaxDays);
      const hatchDaysLeft = Math.ceil((hatchMinDate - today) / (1000 * 60 * 60 * 24));
      const daysSinceEgg = Math.ceil((today - eggDate) / (1000 * 60 * 60 * 24));

      statusHtml = `<span class="breed-status egg">🥚 産卵済み (${daysSinceEgg}日経過)</span>`;
      timelineHtml = `
              <div class="breed-timeline">
                <div class="breed-timeline-item">
                  <span class="tl-label">🐣 ハッチ予定</span>
                  <span class="tl-date">${hatchMinDate.toLocaleDateString('ja-JP')} 〜 ${hatchMaxDate.toLocaleDateString('ja-JP')}</span>
                  ${hatchDaysLeft > 0 ? `<span class="tl-countdown">あと約${hatchDaysLeft}〜${hatchDaysLeft + (hatchMaxDays - hatchMinDays)}日</span>` : `<span class="tl-countdown soon">ハッチの可能性あり！🐣</span>`}
                </div>
                <div class="breed-timeline-item">
                  <span class="tl-label">🌡️ 性別予測 (TSD)</span>
                  <span class="tl-date">${tsdPrediction} (${rec.incubationTemp}℃)</span>
                </div>
              </div>
              <button class="breed-action-btn" onclick="recordHatched('${rec.id}')">🐣 ハッチを記録</button>
            `;
    } else {
      statusHtml = `<span class="breed-status hatched">🐣 ハッチ済み</span>`;
      timelineHtml = `<div class="breed-timeline"><div class="breed-timeline-item complete"><span class="tl-label">✅ 完了</span><span class="tl-date">ハッチ日: ${rec.hatchDate || '不明'}</span></div></div>`;
    }

    return `
        <div class="breeding-record-card ${rec.status}">
          <div class="breed-card-header">
            <span class="breed-pair-name">${rec.pairName}</span>
            ${statusHtml}
          </div>
          <div class="breed-card-dates">
            <span>💕 交尾日: ${new Date(rec.matingDate).toLocaleDateString('ja-JP')}</span>
            ${rec.eggLaidDate ? `<span>🥚 産卵日: ${new Date(rec.eggLaidDate).toLocaleDateString('ja-JP')}</span>` : ''}
            <span>🌡️ 温度: ${rec.incubationTemp}℃</span>
          </div>
          ${rec.memo ? `<div class="breed-memo">📝 ${rec.memo}</div>` : ''}
          ${timelineHtml}
          <button class="breed-delete-btn" onclick="deleteBreedingRecord('${rec.id}')">🗑️ 削除</button>
        </div>`;
  }).join('');
}

function checkBreedingAlerts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rec of state.breedingRecords) {
    if (rec.status === 'mating') {
      const mDate = new Date(rec.matingDate);
      const eggMinDate = new Date(mDate);
      eggMinDate.setDate(eggMinDate.getDate() + 14);
      if (today >= eggMinDate) {
        // 産卵の可能性期間に入った
        showBreedingAlert(`🥚 「${rec.pairName}」が産卵の可能性期間に入りました！産卵床を確認してください。`);
      }
    } else if (rec.status === 'egg_laid' && rec.eggLaidDate) {
      const eggDate = new Date(rec.eggLaidDate);
      let hatchMinDays = 45;
      if (rec.incubationTemp >= 31) hatchMinDays = 35;
      else if (rec.incubationTemp >= 29) hatchMinDays = 45;
      else if (rec.incubationTemp >= 27) hatchMinDays = 55;
      else hatchMinDays = 60;

      const hatchMinDate = new Date(eggDate);
      hatchMinDate.setDate(hatchMinDate.getDate() + hatchMinDays);
      if (today >= hatchMinDate) {
        showBreedingAlert(`🐣 「${rec.pairName}」のハッチが近づいています！孵化器を確認してください。`);
      }
    }
  }
}

function showBreedingAlert(message) {
  // 同じアラートを1日に1回だけ表示
  const alertKey = 'breedAlert_' + btoa(message).substring(0, 20);
  const lastShown = localStorage.getItem(alertKey);
  const todayStr = new Date().toISOString().split('T')[0];
  if (lastShown === todayStr) return;
  localStorage.setItem(alertKey, todayStr);

  setTimeout(() => {
    if (confirm(message + '\n\n繁殖タブを開きますか？')) {
      document.querySelector('[data-tab="breeding"]').click();
    }
  }, 1000);
}

// ====== ユーティリティ ======

// モーダル外クリックで閉じる
document.addEventListener('click', (e) => {
  if (e.target.id === 'morph-modal') {
    closeMorphSelector();
  }
  if (e.target.id === 'het-modal') {
    closeHetModal();
  }
  if (e.target.id === 'breeding-modal') {
    closeBreedingModal();
  }
});

// キーボードショートカット
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMorphSelector();
    closeHetModal();
    closeBreedingModal();
  }
});
