/* =====================================================
   JobScroll — 프론트엔드 애플리케이션 (개선판)
   ===================================================== */

const API_BASE = "";

// ─── 앱 상태 ───────────────────────────────────────────
const state = {
  jobs: [],
  page: 1,
  hasMore: true,
  loading: false,
  category: "전체",
  keyword: "",
  // 고급 필터
  filters: {
    sortBy: "",
    experienceLevel: "",
    employmentType: "",
    location: "",
    salaryMin: 0,
  },
  activeFilterCount: 0,
  // 사용자 데이터
  likedIds: new Set(JSON.parse(localStorage.getItem("likedIds") || "[]")),
  savedJobs: JSON.parse(localStorage.getItem("savedJobs") || "[]"),
  appliedJobs: JSON.parse(localStorage.getItem("appliedJobs") || "[]"),
  historyJobs: JSON.parse(localStorage.getItem("historyJobs") || "[]"),
  viewedCount: parseInt(localStorage.getItem("viewedCount") || "0", 10),
  currentIndex: 0,
  // 온보딩
  onboardStep: 1,
  onboardInterests: new Set(JSON.parse(localStorage.getItem("onboardInterests") || "[]")),
  onboardLocation: localStorage.getItem("onboardLocation") || "",
  onboardExpLevel: localStorage.getItem("onboardExpLevel") || "",
  // UI 상태
  viewMode: localStorage.getItem("viewMode") || "card", // card | list
  theme: localStorage.getItem("theme") || "dark",
  detailJobId: null,
  currentTab: "feed",
  touchStartX: 0,
  touchStartY: 0,
};

// ─── DOM 요소 ───────────────────────────────────────────
const feed = document.getElementById("feed");
const skeletonCard = document.getElementById("skeletonCard");
const topBar = document.getElementById("topBar");
const categoryNav = document.getElementById("categoryNav");
const searchToggleBtn = document.getElementById("searchToggleBtn");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const crawlBtn = document.getElementById("crawlBtn");
const crawlOverlay = document.getElementById("crawlOverlay");
const toast = document.getElementById("toast");
const savedPanel = document.getElementById("savedPanel");
const historyPanel = document.getElementById("historyPanel");
const appliedPanel = document.getElementById("appliedPanel");
const profilePanel = document.getElementById("profilePanel");
const aiUsagePanel = document.getElementById("aiUsagePanel");
const savedList = document.getElementById("savedList");
const historyList = document.getElementById("historyList");
const appliedList = document.getElementById("appliedList");
const savedCountBadge = document.getElementById("savedCountBadge");
const appliedCountBadge = document.getElementById("appliedCountBadge");
const statViewed = document.getElementById("statViewed");
const statLiked = document.getElementById("statLiked");
const statSaved = document.getElementById("statSaved");
const statApplied = document.getElementById("statApplied");
const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.getElementById("filterPanel");
const filterBackdrop = document.getElementById("filterBackdrop");
const filterBadge = document.getElementById("filterBadge");
const filterReset = document.getElementById("filterReset");
const filterClose = document.getElementById("filterClose");
const filterApply = document.getElementById("filterApply");
const salaryRange = document.getElementById("salaryRange");
const salaryRangeLabel = document.getElementById("salaryRangeLabel");
const viewToggleBtn = document.getElementById("viewToggleBtn");
const viewToggleIcon = document.getElementById("viewToggleIcon");
const detailModal = document.getElementById("detailModal");
const detailClose = document.getElementById("detailClose");
const detailContent = document.getElementById("detailContent");
const onboardingOverlay = document.getElementById("onboardingOverlay");
const themeBtn = document.getElementById("themeBtn");
const themeBtnIcon = document.getElementById("themeBtnIcon");
const themeColorMeta = document.getElementById("themeColorMeta");

// ─── 진행 바 ────────────────────────────────────────────
const progressBar = document.createElement("div");
progressBar.className = "progress-bar";
progressBar.setAttribute("role", "progressbar");
progressBar.setAttribute("aria-hidden", "true");
document.body.appendChild(progressBar);

// ─── 초기화 ─────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  applyViewMode(state.viewMode);

  // 온보딩 확인
  const hasOnboarded = localStorage.getItem("hasOnboarded");
  if (!hasOnboarded) {
    onboardingOverlay.style.display = "flex";
    // 이전에 선택한 관심사 복원
    document.querySelectorAll(".onboard-job-btn").forEach((btn) => {
      if (state.onboardInterests.has(btn.dataset.value)) {
        btn.classList.add("selected");
      }
    });
  } else {
    // 저장된 선호 필터 적용
    applyOnboardPreferences();
    loadJobs();
    renderSavedList();
    renderHistoryList();
    renderAppliedList();
    updateStats();
    checkDeadlineAlerts();
  }

  // 프로필 관심사 렌더
  renderProfileInterests();

  // 연봉 슬라이더 이벤트
  salaryRange.addEventListener("input", () => {
    const val = parseInt(salaryRange.value, 10);
    salaryRangeLabel.textContent = val === 0 ? "제한 없음" : `${val.toLocaleString()}만원 이상`;
  });
});

// ─── 온보딩 ─────────────────────────────────────────────
function nextOnboardStep() {
  const currentStep = state.onboardStep;

  // Step 2: 관심 직군 저장
  if (currentStep === 2) {
    const selected = document.querySelectorAll(".onboard-job-btn.selected");
    state.onboardInterests = new Set([...selected].map((b) => b.dataset.value));
    localStorage.setItem("onboardInterests", JSON.stringify([...state.onboardInterests]));
  }

  // Step 3: 지역 저장
  if (currentStep === 3) {
    const selected = document.querySelector(".onboard-loc-btn.selected");
    state.onboardLocation = selected ? selected.dataset.value : "";
    localStorage.setItem("onboardLocation", state.onboardLocation);
  }

  const nextStep = currentStep + 1;
  if (nextStep > 4) {
    finishOnboarding();
    return;
  }

  const steps = document.querySelectorAll(".onboard-step");
  steps.forEach((s) => s.classList.remove("active"));
  const next = document.querySelector(`[data-step="${nextStep}"]`);
  if (next) next.classList.add("active");

  document.querySelectorAll(".onboard-dot").forEach((d) => {
    d.classList.toggle("active", d.dataset.for == nextStep);
  });

  state.onboardStep = nextStep;
}

// 관심 직군 버튼 토글
document.querySelectorAll(".onboard-job-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("selected");
    btn.setAttribute("aria-pressed", btn.classList.contains("selected"));
  });
});

// 지역 버튼 단일 선택
document.querySelectorAll(".onboard-loc-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".onboard-loc-btn").forEach((b) => {
      b.classList.remove("selected");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("selected");
    btn.setAttribute("aria-pressed", "true");
  });
});

function selectExpLevel(btn) {
  document.querySelectorAll(".onboard-exp-btn").forEach((b) => {
    b.classList.remove("selected");
    b.setAttribute("aria-pressed", "false");
  });
  btn.classList.add("selected");
  btn.setAttribute("aria-pressed", "true");
  state.onboardExpLevel = btn.dataset.value;
  localStorage.setItem("onboardExpLevel", state.onboardExpLevel);
}

function finishOnboarding() {
  localStorage.setItem("hasOnboarded", "true");
  onboardingOverlay.style.display = "none";
  applyOnboardPreferences();
  loadJobs();
  renderSavedList();
  renderHistoryList();
  renderAppliedList();
  updateStats();
  checkDeadlineAlerts();
  renderProfileInterests();
  showToast("✨ JobScroll 설정이 완료됐어요!");
}

function applyOnboardPreferences() {
  if (state.onboardExpLevel) {
    state.filters.experienceLevel = state.onboardExpLevel;
  }
  if (state.onboardLocation) {
    state.filters.location = state.onboardLocation;
  }
  updateFilterBadge();
}

function renderProfileInterests() {
  const el = document.getElementById("profileInterests");
  if (!el) return;
  if (state.onboardInterests.size === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="profile-interests-label">관심 직군</div>
    <div class="profile-interests-tags">
      ${[...state.onboardInterests].map((i) => `<span class="interest-tag">${escHtml(i)}</span>`).join("")}
    </div>
  `;
}

// ─── 테마 전환 ──────────────────────────────────────────
themeBtn.addEventListener("click", () => {
  const newTheme = state.theme === "dark" ? "light" : "dark";
  state.theme = newTheme;
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    themeColorMeta.setAttribute("content", "#f5f5f7");
    themeBtnIcon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    `;
  } else {
    themeColorMeta.setAttribute("content", "#0a0a0f");
    themeBtnIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    `;
  }
}

// ─── 보기 모드 전환 (카드/리스트) ───────────────────────
viewToggleBtn.addEventListener("click", () => {
  const newMode = state.viewMode === "card" ? "list" : "card";
  state.viewMode = newMode;
  localStorage.setItem("viewMode", newMode);
  applyViewMode(newMode);
  loadJobs(true);
});

function applyViewMode(mode) {
  feed.classList.toggle("list-mode", mode === "list");
  viewToggleBtn.setAttribute("aria-pressed", mode === "list");
  if (mode === "list") {
    viewToggleIcon.innerHTML = `
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    `;
    viewToggleBtn.title = "카드 보기로 전환";
  } else {
    viewToggleIcon.innerHTML = `
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    `;
    viewToggleBtn.title = "리스트 보기로 전환";
  }
}

// ─── 채용공고 로드 ──────────────────────────────────────
async function loadJobs(reset = false) {
  if (state.loading) return;
  if (!reset && !state.hasMore) return;

  state.loading = true;

  if (reset) {
    state.page = 1;
    state.hasMore = true;
    state.jobs = [];
    state.currentIndex = 0;
    const cards = feed.querySelectorAll(".job-card, .job-list-item, .end-card, .loader-card");
    cards.forEach((c) => c.remove());
    if (!skeletonCard.isConnected) feed.prepend(skeletonCard);
    skeletonCard.style.display = "";
    feed.scrollTo({ top: 0, behavior: "instant" });
  }

  try {
    const params = new URLSearchParams({
      page: state.page,
      ...(state.category !== "전체" && { category: state.category }),
      ...(state.keyword && { keyword: state.keyword }),
      ...(state.filters.sortBy && { sortBy: state.filters.sortBy }),
      ...(state.filters.experienceLevel && { experienceLevel: state.filters.experienceLevel }),
      ...(state.filters.employmentType && { employmentType: state.filters.employmentType }),
      ...(state.filters.location && { location: state.filters.location }),
      ...(state.filters.salaryMin > 0 && { salaryMin: state.filters.salaryMin }),
    });

    const res = await fetch(`${API_BASE}/api/jobs?${params}`);
    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
    const data = await res.json();

    skeletonCard.style.display = "none";

    if (data.jobs.length === 0 && state.page === 1) {
      renderEmptyState();
    } else {
      data.jobs.forEach((job) => {
        state.jobs.push(job);
        const el =
          state.viewMode === "list"
            ? createJobListItem(job, state.jobs.length - 1)
            : createJobCard(job, state.jobs.length - 1);
        feed.appendChild(el);
      });
      state.hasMore = data.hasMore;
      state.page++;

      if (!state.hasMore) {
        feed.appendChild(createEndCard(data.total || state.jobs.length));
      } else {
        const loaderEl = createLoaderCard();
        loaderEl.id = "feedLoader";
        feed.appendChild(loaderEl);
      }
    }
  } catch (err) {
    console.error("공고 로드 실패:", err);
    showToast("데이터를 불러오는 중 오류가 발생했어요.");
    skeletonCard.style.display = "none";
  } finally {
    state.loading = false;
  }
}

// ─── 카드 생성 (카드 모드) ──────────────────────────────
function createJobCard(job, index) {
  const isUrgent = job.dDay !== null && job.dDay <= 7 && job.dDay >= 0;
  const isLiked = state.likedIds.has(job.id);
  const isSaved = state.savedJobs.some((j) => j.id === job.id);
  const isApplied = state.appliedJobs.some((j) => j.id === job.id);

  const card = document.createElement("article");
  card.className = "job-card";
  card.dataset.jobId = job.id;
  card.dataset.index = index;
  card.setAttribute("aria-label", `${job.company} — ${job.title}`);
  card.setAttribute("tabindex", "0");

  card.innerHTML = `
    <div class="card-bg" style="background: ${job.gradient};" aria-hidden="true"></div>
    <div class="card-overlay" aria-hidden="true"></div>
    <div class="card-index" aria-hidden="true">${index + 1}</div>

    <div class="card-content">
      <div class="company-row">
        <div class="company-logo" style="background: rgba(255,255,255,0.2);" aria-hidden="true">${escHtml(job.logoText)}</div>
        <span class="company-name">${escHtml(job.company)}</span>
        <span class="employment-badge ${job.experienceLevel === "신입" ? "badge-new" : ""}">${escHtml(job.employmentType || "")}</span>
        <span class="company-source">${escHtml(job.source || "")}</span>
      </div>

      <h2 class="job-title">${escHtml(job.title)}</h2>
      ${job.department ? `<p class="job-dept">${escHtml(job.department)}</p>` : ""}

      <div class="meta-row">
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          ${escHtml(job.location)}
        </span>
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          ${escHtml(job.salary)}
        </span>
        <span class="meta-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          ${escHtml(job.experience)}
        </span>
      </div>

      ${
        job.skills && job.skills.length > 0
          ? `<div class="skills-row" aria-label="필요 스킬">
          ${job.skills.slice(0, 5).map((s) => `<span class="skill-tag">${escHtml(s)}</span>`).join("")}
        </div>`
          : ""
      }

      ${
        job.mainTasks && job.mainTasks.length > 0
          ? `<div class="tasks-section">
          <p class="section-label">주요 업무</p>
          ${job.mainTasks.slice(0, 2).map((t) => `<div class="task-item">${escHtml(t)}</div>`).join("")}
        </div>`
          : ""
      }

      ${
        job.benefits && job.benefits.length > 0
          ? `<div class="benefits-row" aria-label="복지">
          ${job.benefits.slice(0, 3).map((b) => `<span class="benefit-tag">✓ ${escHtml(b)}</span>`).join("")}
        </div>`
          : ""
      }

      <div class="card-footer">
        <div class="deadline-badge ${isUrgent ? "urgent" : "normal"}" aria-label="마감일">
          <span class="deadline-dot" aria-hidden="true"></span>
          ${
            job.dDay !== null && job.dDay >= 0
              ? job.dDay === 0
                ? `<span style="color:#ff6b6b;font-weight:700">오늘 마감!</span>`
                : isUrgent
                ? `마감 D-${job.dDay}`
                : `마감 ${escHtml(job.deadline)}`
              : `${escHtml(job.deadline)}`
          }
        </div>
        <div class="card-footer-btns">
          <button class="detail-btn" onclick="openDetail(${job.id})" aria-label="${escHtml(job.title)} 상세 보기">
            상세보기
          </button>
          <button class="apply-btn ${isApplied ? "applied" : ""}" onclick="handleApply(${job.id})" aria-label="${isApplied ? "지원완료" : "지원하기"}">
            ${isApplied ? "✓ 지원완료" : "지원하기 →"}
          </button>
        </div>
      </div>
    </div>

    <div class="action-sidebar" role="group" aria-label="공고 액션">
      <button
        class="action-btn like-btn ${isLiked ? "liked" : ""}"
        onclick="handleLike(${job.id}, this)"
        aria-label="${isLiked ? "좋아요 취소" : "좋아요"}"
        aria-pressed="${isLiked}"
      >
        <div class="action-icon" aria-hidden="true">${isLiked ? "❤️" : "🤍"}</div>
        <span class="action-label like-count">${formatNum(job.likes + (isLiked ? 1 : 0))}</span>
      </button>

      <button
        class="action-btn save-btn ${isSaved ? "bookmarked" : ""}"
        onclick="handleSave(${job.id}, this)"
        aria-label="${isSaved ? "저장 취소" : "저장"}"
        aria-pressed="${isSaved}"
      >
        <div class="action-icon" aria-hidden="true">${isSaved ? "🔖" : "📌"}</div>
        <span class="action-label">${isSaved ? "저장됨" : "저장"}</span>
      </button>

      <button class="action-btn" onclick="handleShare(${job.id})" aria-label="공유하기">
        <div class="action-icon" aria-hidden="true">↗️</div>
        <span class="action-label">공유</span>
      </button>
    </div>

    <div class="scroll-hint" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      다음 공고
    </div>
  `;

  // 스와이프 제스처
  addSwipeGesture(card, job.id);
  // 키보드 접근성
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openDetail(job.id);
    if (e.key === "ArrowDown") feed.scrollBy({ top: feed.clientHeight, behavior: "smooth" });
    if (e.key === "ArrowUp") feed.scrollBy({ top: -feed.clientHeight, behavior: "smooth" });
  });

  return card;
}

// ─── 리스트 아이템 생성 (리스트 모드) ──────────────────
function createJobListItem(job, index) {
  const isLiked = state.likedIds.has(job.id);
  const isSaved = state.savedJobs.some((j) => j.id === job.id);
  const isApplied = state.appliedJobs.some((j) => j.id === job.id);
  const isUrgent = job.dDay !== null && job.dDay <= 7 && job.dDay >= 0;

  const el = document.createElement("article");
  el.className = "job-list-item";
  el.dataset.jobId = job.id;
  el.dataset.index = index;
  el.setAttribute("aria-label", `${job.company} — ${job.title}`);
  el.setAttribute("tabindex", "0");

  el.innerHTML = `
    <div class="list-item-logo" style="background: ${job.gradient};" aria-hidden="true">${escHtml(job.logoText)}</div>
    <div class="list-item-info">
      <div class="list-item-top">
        <span class="list-item-company">${escHtml(job.company)}</span>
        <span class="employment-badge ${job.experienceLevel === "신입" ? "badge-new" : ""}">${escHtml(job.employmentType || "")}</span>
        ${isUrgent ? `<span class="list-urgent-badge">D-${job.dDay}</span>` : ""}
      </div>
      <p class="list-item-title">${escHtml(job.title)}</p>
      <div class="list-item-meta">
        <span>${escHtml(job.location)}</span>
        <span>·</span>
        <span>${escHtml(job.salary)}</span>
        <span>·</span>
        <span>${escHtml(job.experience)}</span>
      </div>
      ${
        job.skills && job.skills.length > 0
          ? `<div class="list-item-skills">${job.skills.slice(0, 4).map((s) => `<span class="skill-tag-sm">${escHtml(s)}</span>`).join("")}</div>`
          : ""
      }
    </div>
    <div class="list-item-actions">
      <button
        class="list-action-btn ${isSaved ? "bookmarked" : ""}"
        onclick="handleSave(${job.id}, this)"
        aria-label="${isSaved ? "저장 취소" : "저장"}"
        aria-pressed="${isSaved}"
      >${isSaved ? "🔖" : "📌"}</button>
      <button class="list-detail-btn" onclick="openDetail(${job.id})" aria-label="상세 보기">→</button>
    </div>
  `;

  el.addEventListener("click", (e) => {
    if (!e.target.closest("button")) openDetail(job.id);
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openDetail(job.id);
  });

  return el;
}

// ─── 스와이프 제스처 ────────────────────────────────────
function addSwipeGesture(card, jobId) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  card.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  card.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60 && dt < 400) {
      if (dx > 0) {
        // 오른쪽 스와이프 → 저장
        const saveBtn = card.querySelector(".save-btn");
        if (saveBtn) handleSave(jobId, saveBtn);
      } else {
        // 왼쪽 스와이프 → 다음 공고
        feed.scrollBy({ top: feed.clientHeight, behavior: "smooth" });
      }
    }
  }, { passive: true });
}

// ─── 공고 상세 모달 ─────────────────────────────────────
function openDetail(jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;

  state.detailJobId = jobId;
  const isLiked = state.likedIds.has(job.id);
  const isSaved = state.savedJobs.some((j) => j.id === job.id);
  const isApplied = state.appliedJobs.some((j) => j.id === job.id);
  const isUrgent = job.dDay !== null && job.dDay <= 7 && job.dDay >= 0;

  detailContent.innerHTML = `
    <div class="detail-hero" style="background: ${job.gradient};">
      <div class="detail-hero-logo" aria-hidden="true">${escHtml(job.logoText)}</div>
      <div class="detail-hero-info">
        <span class="detail-company">${escHtml(job.company)}</span>
        <span class="employment-badge ${job.experienceLevel === "신입" ? "badge-new" : ""}">${escHtml(job.employmentType || "")}</span>
      </div>
      <h2 class="detail-title">${escHtml(job.title)}</h2>
      ${job.department ? `<p class="detail-dept">${escHtml(job.department)}</p>` : ""}
    </div>

    <div class="detail-body">
      <!-- 핵심 정보 -->
      <div class="detail-meta-grid" role="list">
        <div class="detail-meta-item" role="listitem">
          <span class="detail-meta-icon" aria-hidden="true">📍</span>
          <div>
            <p class="detail-meta-label">근무지</p>
            <p class="detail-meta-value">${escHtml(job.location)}</p>
          </div>
        </div>
        <div class="detail-meta-item" role="listitem">
          <span class="detail-meta-icon" aria-hidden="true">💰</span>
          <div>
            <p class="detail-meta-label">연봉</p>
            <p class="detail-meta-value">${escHtml(job.salary)}</p>
          </div>
        </div>
        <div class="detail-meta-item" role="listitem">
          <span class="detail-meta-icon" aria-hidden="true">⏱️</span>
          <div>
            <p class="detail-meta-label">경력</p>
            <p class="detail-meta-value">${escHtml(job.experience)}</p>
          </div>
        </div>
        <div class="detail-meta-item ${isUrgent ? "urgent-meta" : ""}" role="listitem">
          <span class="detail-meta-icon" aria-hidden="true">📅</span>
          <div>
            <p class="detail-meta-label">마감일</p>
            <p class="detail-meta-value">${
              job.dDay === 0
                ? '<span style="color:var(--accent2);font-weight:700">오늘 마감!</span>'
                : job.dDay > 0
                ? `${escHtml(job.deadline)} (D-${job.dDay})`
                : escHtml(job.deadline)
            }</p>
          </div>
        </div>
      </div>

      <!-- 기술 스택 -->
      ${job.skills && job.skills.length > 0 ? `
      <section class="detail-section" aria-labelledby="skills-heading">
        <h3 class="detail-section-title" id="skills-heading">🛠️ 기술 스택</h3>
        <div class="skills-row">${job.skills.map((s) => `<span class="skill-tag">${escHtml(s)}</span>`).join("")}</div>
      </section>` : ""}

      <!-- 주요 업무 -->
      ${job.mainTasks && job.mainTasks.length > 0 ? `
      <section class="detail-section" aria-labelledby="tasks-heading">
        <h3 class="detail-section-title" id="tasks-heading">📋 주요 업무</h3>
        <ul class="detail-list">
          ${job.mainTasks.map((t) => `<li>${escHtml(t)}</li>`).join("")}
        </ul>
      </section>` : ""}

      <!-- 자격 요건 -->
      ${job.requirements && job.requirements.length > 0 ? `
      <section class="detail-section" aria-labelledby="req-heading">
        <h3 class="detail-section-title" id="req-heading">✅ 자격 요건</h3>
        <ul class="detail-list">
          ${job.requirements.map((r) => `<li>${escHtml(r)}</li>`).join("")}
        </ul>
      </section>` : ""}

      <!-- 우대 사항 -->
      ${job.preferred && job.preferred.length > 0 ? `
      <section class="detail-section" aria-labelledby="pref-heading">
        <h3 class="detail-section-title" id="pref-heading">⭐ 우대 사항</h3>
        <ul class="detail-list preferred-list">
          ${job.preferred.map((p) => `<li>${escHtml(p)}</li>`).join("")}
        </ul>
      </section>` : ""}

      <!-- 복지 혜택 -->
      ${job.benefits && job.benefits.length > 0 ? `
      <section class="detail-section" aria-labelledby="benefits-heading">
        <h3 class="detail-section-title" id="benefits-heading">🎁 복지 혜택</h3>
        <div class="benefits-row">${job.benefits.map((b) => `<span class="benefit-tag">✓ ${escHtml(b)}</span>`).join("")}</div>
      </section>` : ""}

      <!-- 회사 소개 -->
      ${job.companyInfo ? `
      <section class="detail-section" aria-labelledby="company-heading">
        <h3 class="detail-section-title" id="company-heading">🏢 회사 소개</h3>
        <p class="detail-company-info">${escHtml(job.companyInfo)}</p>
      </section>` : ""}

      <!-- 출처 -->
      <p class="detail-source">출처: ${escHtml(job.source || "")}</p>
    </div>

    <!-- 하단 액션 바 -->
    <div class="detail-action-bar">
      <button
        class="detail-like-btn ${isLiked ? "liked" : ""}"
        onclick="handleLikeFromDetail(${job.id}, this)"
        aria-label="${isLiked ? "좋아요 취소" : "좋아요"}"
        aria-pressed="${isLiked}"
      >${isLiked ? "❤️" : "🤍"} ${formatNum(job.likes + (isLiked ? 1 : 0))}</button>
      <button
        class="detail-save-btn ${isSaved ? "bookmarked" : ""}"
        onclick="handleSaveFromDetail(${job.id}, this)"
        aria-label="${isSaved ? "저장 취소" : "저장하기"}"
        aria-pressed="${isSaved}"
      >${isSaved ? "🔖 저장됨" : "📌 저장하기"}</button>
      <button
        class="detail-apply-btn ${isApplied ? "applied" : ""}"
        onclick="handleApply(${job.id})"
        aria-label="${isApplied ? "지원완료" : "지원하기"}"
      >${isApplied ? "✓ 지원완료" : "지원하기 →"}</button>
    </div>
  `;

  detailModal.classList.add("active");
  document.body.style.overflow = "hidden";
  detailContent.focus();

  // 히스토리에 추가
  addToHistory(job);
}

detailClose.addEventListener("click", closeDetail);
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetail();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (detailModal.classList.contains("active")) closeDetail();
    if (filterPanel.classList.contains("active")) closeFilterPanel();
  }
});

function closeDetail() {
  detailModal.classList.remove("active");
  document.body.style.overflow = "";
  state.detailJobId = null;
}

// 상세 모달에서 좋아요/저장
function handleLikeFromDetail(jobId, btn) {
  handleLike(jobId, null);
  const job = state.jobs.find((j) => j.id === jobId);
  const isLiked = state.likedIds.has(jobId);
  if (btn) {
    btn.textContent = `${isLiked ? "❤️" : "🤍"} ${formatNum((job ? job.likes : 0) + (isLiked ? 1 : 0))}`;
    btn.classList.toggle("liked", isLiked);
    btn.setAttribute("aria-pressed", isLiked);
    btn.setAttribute("aria-label", isLiked ? "좋아요 취소" : "좋아요");
  }
}

function handleSaveFromDetail(jobId, btn) {
  const saveBtn = feed.querySelector(`[data-job-id="${jobId}"] .save-btn`);
  handleSave(jobId, saveBtn);
  const isSaved = state.savedJobs.some((j) => j.id === jobId);
  if (btn) {
    btn.textContent = isSaved ? "🔖 저장됨" : "📌 저장하기";
    btn.classList.toggle("bookmarked", isSaved);
    btn.setAttribute("aria-pressed", isSaved);
    btn.setAttribute("aria-label", isSaved ? "저장 취소" : "저장하기");
  }
}

// ─── 히스토리 관리 ──────────────────────────────────────
function addToHistory(job) {
  const exists = state.historyJobs.find((j) => j.id === job.id);
  if (!exists) {
    state.historyJobs.unshift(job);
    if (state.historyJobs.length > 50) state.historyJobs.pop();
    localStorage.setItem("historyJobs", JSON.stringify(state.historyJobs));
    renderHistoryList();
  }
}

function renderHistoryList() {
  if (state.historyJobs.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🕐</div>
        <p>아직 본 공고가 없어요.<br/>피드를 스크롤하면 여기에 기록돼요.</p>
      </div>`;
    return;
  }
  historyList.innerHTML = state.historyJobs
    .map((job) => createSavedItemHTML(job, "history"))
    .join("");
}

// ─── 로더/엔드 카드 ─────────────────────────────────────
function createLoaderCard() {
  const el = document.createElement("div");
  el.className = "loader-card";
  el.setAttribute("aria-label", "다음 공고 로딩 중");
  el.innerHTML = `
    <div class="loader-spinner" aria-hidden="true"></div>
    <p class="loader-text">다음 공고 불러오는 중...</p>
  `;
  return el;
}

function createEndCard(total) {
  const el = document.createElement("div");
  el.className = "end-card";
  el.innerHTML = `
    <div class="end-icon" aria-hidden="true">🎉</div>
    <p class="end-title">모든 공고를 확인했어요!</p>
    <p class="end-sub">총 ${total || state.jobs.length}개 공고를 탐색했어요.<br/>관심 있는 공고를 저장하고 지원해 보세요.</p>
    <button class="restart-btn" onclick="restartFeed()">처음부터 다시 보기</button>
  `;
  return el;
}

function renderEmptyState() {
  const el = document.createElement("div");
  el.className = "end-card";
  el.innerHTML = `
    <div class="end-icon" aria-hidden="true">🔍</div>
    <p class="end-title">검색 결과가 없어요</p>
    <p class="end-sub">다른 키워드나 필터로 검색해 보세요.</p>
    <button class="restart-btn" onclick="resetAll()">전체 공고 보기</button>
  `;
  skeletonCard.style.display = "none";
  feed.appendChild(el);
}

// ─── 스크롤 감지 ────────────────────────────────────────
let scrollDebounce;
feed.addEventListener("scroll", () => {
  clearTimeout(scrollDebounce);
  scrollDebounce = setTimeout(() => {
    updateProgress();
    if (state.viewMode === "card") updateCardIndex();
    checkLoadMore();
  }, 60);
}, { passive: true });

function updateProgress() {
  const scrollTop = feed.scrollTop;
  const scrollHeight = feed.scrollHeight - feed.clientHeight;
  if (scrollHeight <= 0) return;
  const pct = (scrollTop / scrollHeight) * 100;
  progressBar.style.width = pct + "%";
}

function updateCardIndex() {
  const cardH = feed.clientHeight;
  if (cardH === 0) return;
  const idx = Math.round(feed.scrollTop / cardH);
  if (idx !== state.currentIndex) {
    state.currentIndex = idx;
    if (idx > state.viewedCount) {
      state.viewedCount = idx;
      localStorage.setItem("viewedCount", state.viewedCount);
      updateStats();
    }
    // 현재 카드를 히스토리에 추가
    const currentJob = state.jobs[idx];
    if (currentJob) addToHistory(currentJob);
  }
}

function checkLoadMore() {
  const loader = document.getElementById("feedLoader");
  if (!loader) return;
  const loaderTop = loader.getBoundingClientRect().top;
  const windowH = window.innerHeight;
  if (loaderTop < windowH * 1.5) {
    loader.remove();
    loadJobs();
  }
}

// ─── 좋아요 ────────────────────────────────────────────
function handleLike(jobId, btn) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;

  if (state.likedIds.has(jobId)) {
    state.likedIds.delete(jobId);
    showToast("좋아요를 취소했어요");
  } else {
    state.likedIds.add(jobId);
    showToast("❤️ 좋아요!");
  }

  const isLiked = state.likedIds.has(jobId);

  if (btn) {
    const iconEl = btn.querySelector(".action-icon");
    const countEl = btn.querySelector(".like-count");
    btn.classList.toggle("liked", isLiked);
    if (iconEl) {
      iconEl.textContent = isLiked ? "❤️" : "🤍";
      if (isLiked) {
        iconEl.classList.add("pulse");
        iconEl.addEventListener("animationend", () => iconEl.classList.remove("pulse"), { once: true });
      }
    }
    if (countEl) countEl.textContent = formatNum(job.likes + (isLiked ? 1 : 0));
    btn.setAttribute("aria-pressed", isLiked);
    btn.setAttribute("aria-label", isLiked ? "좋아요 취소" : "좋아요");
  }

  localStorage.setItem("likedIds", JSON.stringify([...state.likedIds]));
  updateStats();
}

// ─── 저장 ──────────────────────────────────────────────
function handleSave(jobId, btn) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;

  const alreadySaved = state.savedJobs.some((j) => j.id === jobId);

  if (alreadySaved) {
    state.savedJobs = state.savedJobs.filter((j) => j.id !== jobId);
    showToast("저장 목록에서 제거됐어요");
  } else {
    state.savedJobs.push(job);
    showToast("🔖 저장 목록에 추가됐어요!");
  }

  const isSaved = state.savedJobs.some((j) => j.id === jobId);

  if (btn) {
    const iconEl = btn.querySelector(".action-icon");
    const labelEl = btn.querySelector(".action-label");
    btn.classList.toggle("bookmarked", isSaved);
    if (iconEl) {
      iconEl.textContent = isSaved ? "🔖" : "📌";
      if (isSaved) {
        iconEl.classList.add("pulse");
        iconEl.addEventListener("animationend", () => iconEl.classList.remove("pulse"), { once: true });
      }
    }
    if (labelEl) labelEl.textContent = isSaved ? "저장됨" : "저장";
    btn.setAttribute("aria-pressed", isSaved);
    btn.setAttribute("aria-label", isSaved ? "저장 취소" : "저장");
  }

  // 리스트 모드 버튼 업데이트
  const listBtn = feed.querySelector(`[data-job-id="${jobId}"] .list-action-btn`);
  if (listBtn) {
    listBtn.textContent = isSaved ? "🔖" : "📌";
    listBtn.classList.toggle("bookmarked", isSaved);
  }

  localStorage.setItem("savedJobs", JSON.stringify(state.savedJobs));
  renderSavedList();
  updateStats();
  updateNavBadges();
  checkDeadlineAlerts();
}

// ─── 공유 ──────────────────────────────────────────────
function handleShare(jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;
  const text = `${job.company} — ${job.title} 공고를 JobScroll에서 발견했어요!`;
  const shareData = { title: job.title, text, url: job.url && job.url !== "#" ? job.url : window.location.href };
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard
      .writeText(`${text}\n${shareData.url}`)
      .then(() => showToast("📤 클립보드에 복사됐어요!"))
      .catch(() => showToast("공유하기를 지원하지 않는 브라우저예요."));
  }
}

// ─── 지원하기 ──────────────────────────────────────────
function handleApply(jobId) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) return;

  const alreadyApplied = state.appliedJobs.some((j) => j.id === jobId);

  if (alreadyApplied) {
    showToast("이미 지원한 공고예요. 상세에서 확인하세요.");
    return;
  }

  // 지원 이력에 추가
  state.appliedJobs.push({ ...job, appliedAt: new Date().toISOString() });
  localStorage.setItem("appliedJobs", JSON.stringify(state.appliedJobs));
  renderAppliedList();
  updateStats();
  updateNavBadges();

  // 버튼 상태 업데이트
  const applyBtn = feed.querySelector(`[data-job-id="${jobId}"] .apply-btn`);
  if (applyBtn) {
    applyBtn.textContent = "✓ 지원완료";
    applyBtn.classList.add("applied");
    applyBtn.setAttribute("aria-label", "지원완료");
  }

  // 실제 채용 페이지 열기
  if (job.url && job.url !== "#") {
    window.open(job.url, "_blank", "noopener,noreferrer");
    showToast("🎯 지원 페이지로 이동했어요! 지원 이력에 기록됐습니다.");
  } else {
    showToast("✅ 지원 이력에 기록됐어요!");
  }
}

// ─── 실시간 크롤링 ─────────────────────────────────────
crawlBtn.addEventListener("click", async () => {
  crawlOverlay.classList.add("active");
  try {
    const res = await fetch(`${API_BASE}/api/crawl`, { method: "POST" });
    const data = await res.json();
    crawlOverlay.classList.remove("active");
    if (data.success) {
      const msg = data.cached
        ? `✅ 캐시된 데이터 사용 중 (${data.count}개)`
        : `✅ ${data.count}개 공고를 새로 수집했어요!`;
      showToast(msg);
      await loadJobs(true);
    } else {
      showToast("크롤링 중 문제가 발생했어요. 기존 데이터를 사용합니다.");
    }
  } catch {
    crawlOverlay.classList.remove("active");
    showToast("서버 연결 실패 — 기존 데이터를 사용합니다.");
  }
});

// ─── 검색 ──────────────────────────────────────────────
let searchTimeout;
searchToggleBtn.addEventListener("click", () => {
  const isOpen = searchBar.classList.toggle("open");
  feed.classList.toggle("search-open", isOpen);
  searchToggleBtn.setAttribute("aria-expanded", isOpen);
  if (isOpen) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    if (state.keyword) {
      state.keyword = "";
      loadJobs(true);
    }
  }
});

searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.keyword = e.target.value.trim();
    loadJobs(true);
  }, 400);
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  state.keyword = "";
  loadJobs(true);
  searchInput.focus();
});

// ─── 카테고리 필터 ─────────────────────────────────────
categoryNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".cat-btn");
  if (!btn) return;
  document.querySelectorAll(".cat-btn").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  btn.classList.add("active");
  btn.setAttribute("aria-pressed", "true");
  state.category = btn.dataset.category;
  loadJobs(true);
});

// ─── 필터 패널 ─────────────────────────────────────────
filterBtn.addEventListener("click", () => {
  filterPanel.classList.add("active");
  filterBackdrop.classList.add("active");
  filterBtn.setAttribute("aria-expanded", "true");
});

function closeFilterPanel() {
  filterPanel.classList.remove("active");
  filterBackdrop.classList.remove("active");
  filterBtn.setAttribute("aria-expanded", "false");
}

filterClose.addEventListener("click", closeFilterPanel);
filterBackdrop.addEventListener("click", closeFilterPanel);

// 필터 칩 선택
document.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const filterKey = chip.dataset.filter;
    const val = chip.dataset.value;
    document.querySelectorAll(`.filter-chip[data-filter="${filterKey}"]`).forEach((c) => {
      c.classList.remove("active");
      c.setAttribute("aria-pressed", "false");
    });
    chip.classList.add("active");
    chip.setAttribute("aria-pressed", "true");
    state.filters[filterKey] = val;
  });
});

filterReset.addEventListener("click", () => {
  state.filters = { sortBy: "", experienceLevel: "", employmentType: "", location: "", salaryMin: 0 };
  document.querySelectorAll(".filter-chip").forEach((c) => {
    const isDefault = c.dataset.value === "";
    c.classList.toggle("active", isDefault);
    c.setAttribute("aria-pressed", isDefault ? "true" : "false");
  });
  salaryRange.value = 0;
  salaryRangeLabel.textContent = "제한 없음";
  updateFilterBadge();
  showToast("필터가 초기화됐어요");
});

filterApply.addEventListener("click", () => {
  state.filters.salaryMin = parseInt(salaryRange.value, 10);
  updateFilterBadge();
  closeFilterPanel();
  loadJobs(true);
});

function updateFilterBadge() {
  const active = Object.values(state.filters).filter((v) => v !== "" && v !== 0).length;
  state.activeFilterCount = active;
  if (active > 0) {
    filterBadge.textContent = active;
    filterBadge.style.display = "flex";
  } else {
    filterBadge.style.display = "none";
  }
}

// ─── 탭 내비게이션 ─────────────────────────────────────
document.querySelectorAll(".bottom-nav__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".bottom-nav__btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");

    [savedPanel, historyPanel, appliedPanel, profilePanel, aiUsagePanel].forEach((p) => p.classList.remove("active"));

    state.currentTab = tab;
    if (tab === "saved") savedPanel.classList.add("active");
    else if (tab === "history") historyPanel.classList.add("active");
    else if (tab === "applied") appliedPanel.classList.add("active");
    else if (tab === "profile") {
      updateStats();
      profilePanel.classList.add("active");
    } else if (tab === "aiUsage") {
      renderAiUsage();
      aiUsagePanel.classList.add("active");
    }
  });
});

// ─── 저장 목록 렌더링 ──────────────────────────────────
function renderSavedList() {
  savedCountBadge.textContent = state.savedJobs.length;
  if (state.savedJobs.length === 0) {
    savedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🔖</div>
        <p>저장한 공고가 없어요.<br/>마음에 드는 공고를 저장해 보세요!</p>
      </div>`;
    return;
  }
  savedList.innerHTML = state.savedJobs.map((job) => createSavedItemHTML(job, "saved")).join("");
}

// ─── 지원 이력 렌더링 ──────────────────────────────────
function renderAppliedList() {
  appliedCountBadge.textContent = state.appliedJobs.length;
  if (state.appliedJobs.length === 0) {
    appliedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">📋</div>
        <p>아직 지원한 공고가 없어요.<br/>공고 상세에서 지원하기를 눌러보세요!</p>
      </div>`;
    return;
  }
  appliedList.innerHTML = state.appliedJobs
    .map((job) => {
      const appliedDate = job.appliedAt ? new Date(job.appliedAt).toLocaleDateString("ko-KR") : "";
      return `
      <div class="saved-item applied-item">
        <div class="saved-item__logo" style="background: ${job.gradient};" aria-hidden="true">${escHtml(job.logoText)}</div>
        <div class="saved-item__info">
          <p class="saved-item__company">${escHtml(job.company)}</p>
          <p class="saved-item__title">${escHtml(job.title)}</p>
          <p class="saved-item__meta">${escHtml(job.location)} · ${appliedDate ? `지원일 ${appliedDate}` : ""}</p>
        </div>
        <div class="applied-status">
          <span class="applied-badge">지원완료</span>
          ${job.url && job.url !== "#"
            ? `<a href="${job.url}" target="_blank" rel="noopener noreferrer" class="applied-link-btn" aria-label="${escHtml(job.company)} 채용 페이지">확인</a>`
            : ""}
        </div>
      </div>`;
    })
    .join("");
}

function createSavedItemHTML(job, type) {
  const isUrgent = job.dDay !== null && job.dDay <= 7 && job.dDay >= 0;
  return `
    <div class="saved-item" onclick="openDetailFromPanel(${job.id})" tabindex="0" role="button" aria-label="${escHtml(job.company)} ${escHtml(job.title)} 상세 보기" onkeydown="if(event.key==='Enter')openDetailFromPanel(${job.id})">
      <div class="saved-item__logo" style="background: ${job.gradient};" aria-hidden="true">${escHtml(job.logoText)}</div>
      <div class="saved-item__info">
        <p class="saved-item__company">${escHtml(job.company)}</p>
        <p class="saved-item__title">${escHtml(job.title)}</p>
        <p class="saved-item__meta">${escHtml(job.location)} · ${escHtml(job.experience)}</p>
        ${isUrgent ? `<p class="saved-item__urgent" role="alert">⚠️ D-${job.dDay} 마감 임박!</p>` : ""}
      </div>
      ${type === "saved"
        ? `<button class="saved-item__remove" onclick="removeSaved(event, ${job.id})" aria-label="${escHtml(job.title)} 저장 취소">✕</button>`
        : ""}
    </div>`;
}

function openDetailFromPanel(jobId) {
  // 해당 job이 현재 state.jobs에 없으면 savedJobs / historyJobs에서 찾아 임시 추가
  let job = state.jobs.find((j) => j.id === jobId);
  if (!job) {
    job = state.savedJobs.find((j) => j.id === jobId)
      || state.historyJobs.find((j) => j.id === jobId)
      || state.appliedJobs.find((j) => j.id === jobId);
    if (job) state.jobs.push(job);
  }
  if (job) openDetail(jobId);
}

function removeSaved(event, jobId) {
  event.stopPropagation();
  state.savedJobs = state.savedJobs.filter((j) => j.id !== jobId);
  localStorage.setItem("savedJobs", JSON.stringify(state.savedJobs));
  renderSavedList();
  updateStats();
  updateNavBadges();
  showToast("저장 목록에서 제거됐어요");

  const saveBtn = feed.querySelector(`[data-job-id="${jobId}"] .save-btn`);
  if (saveBtn) {
    saveBtn.classList.remove("bookmarked");
    const icon = saveBtn.querySelector(".action-icon");
    const label = saveBtn.querySelector(".action-label");
    if (icon) icon.textContent = "📌";
    if (label) label.textContent = "저장";
    saveBtn.setAttribute("aria-pressed", "false");
  }
}

function scrollToJob(jobId) {
  [savedPanel, historyPanel, appliedPanel, profilePanel].forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".bottom-nav__btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === "feed");
    b.setAttribute("aria-pressed", b.dataset.tab === "feed" ? "true" : "false");
  });
  const card = feed.querySelector(`[data-job-id="${jobId}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth" });
}

// ─── 마감 임박 알림 ─────────────────────────────────────
function checkDeadlineAlerts() {
  const urgentJobs = state.savedJobs.filter((j) => j.dDay !== null && j.dDay <= 3 && j.dDay >= 0);
  const section = document.getElementById("deadlineAlertSection");
  const list = document.getElementById("deadlineAlertList");
  if (!section || !list) return;
  if (urgentJobs.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  list.innerHTML = urgentJobs
    .map(
      (j) => `
    <div class="deadline-alert-item" onclick="openDetailFromPanel(${j.id})" role="button" tabindex="0" aria-label="${escHtml(j.title)} 마감 ${j.dDay}일 전">
      <span class="deadline-alert-company">${escHtml(j.company)}</span>
      <span class="deadline-alert-title">${escHtml(j.title)}</span>
      <span class="deadline-alert-d ${j.dDay === 0 ? "today" : ""}">D-${j.dDay}</span>
    </div>`
    )
    .join("");
}

// ─── 통계 업데이트 ─────────────────────────────────────
function updateStats() {
  statViewed.textContent = state.viewedCount;
  statLiked.textContent = state.likedIds.size;
  statSaved.textContent = state.savedJobs.length;
  statApplied.textContent = state.appliedJobs.length;
}

function updateNavBadges() {
  const savedBadge = document.getElementById("savedBadge");
  const appliedBadge = document.getElementById("appliedBadge");
  if (state.savedJobs.length > 0) {
    savedBadge.textContent = state.savedJobs.length;
    savedBadge.style.display = "flex";
  } else {
    savedBadge.style.display = "none";
  }
  if (state.appliedJobs.length > 0) {
    appliedBadge.textContent = state.appliedJobs.length;
    appliedBadge.style.display = "flex";
  } else {
    appliedBadge.style.display = "none";
  }
}

// ─── 프로필 액션 ────────────────────────────────────────
function resetAllData() {
  if (!confirm("모든 활동 데이터(좋아요, 저장, 지원이력, 히스토리)를 초기화할까요?")) return;
  state.likedIds = new Set();
  state.savedJobs = [];
  state.appliedJobs = [];
  state.historyJobs = [];
  state.viewedCount = 0;
  localStorage.removeItem("likedIds");
  localStorage.removeItem("savedJobs");
  localStorage.removeItem("appliedJobs");
  localStorage.removeItem("historyJobs");
  localStorage.removeItem("viewedCount");
  renderSavedList();
  renderHistoryList();
  renderAppliedList();
  updateStats();
  updateNavBadges();
  loadJobs(true);
  showToast("데이터가 초기화됐어요");
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    liked: [...state.likedIds],
    saved: state.savedJobs.map((j) => ({ id: j.id, company: j.company, title: j.title, deadline: j.deadline })),
    applied: state.appliedJobs.map((j) => ({ id: j.id, company: j.company, title: j.title, appliedAt: j.appliedAt })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jobscroll-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("📁 활동 데이터가 내보내기 됐어요!");
}

// ─── 처음부터 다시 / 전체 초기화 ───────────────────────
function restartFeed() {
  feed.scrollTo({ top: 0, behavior: "smooth" });
}

function resetAll() {
  state.keyword = "";
  state.category = "전체";
  state.filters = { sortBy: "", experienceLevel: "", employmentType: "", location: "", salaryMin: 0 };
  searchInput.value = "";
  document.querySelectorAll(".cat-btn").forEach((b) => {
    const isAll = b.dataset.category === "전체";
    b.classList.toggle("active", isAll);
    b.setAttribute("aria-pressed", isAll ? "true" : "false");
  });
  document.querySelectorAll(".filter-chip").forEach((c) => {
    const isDefault = c.dataset.value === "";
    c.classList.toggle("active", isDefault);
    c.setAttribute("aria-pressed", isDefault ? "true" : "false");
  });
  salaryRange.value = 0;
  salaryRangeLabel.textContent = "제한 없음";
  updateFilterBadge();
  loadJobs(true);
}

// ─── 토스트 ────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  clearTimeout(toastTimeout);
  toast.textContent = msg;
  toast.classList.add("show");
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ─── 유틸리티 ──────────────────────────────────────────
function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(n) {
  if (!n) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ─── 키보드 네비게이션 (피드) ───────────────────────────
document.addEventListener("keydown", (e) => {
  if (detailModal.classList.contains("active")) return;
  if (filterPanel.classList.contains("active")) return;
  if (document.activeElement === searchInput) return;
  if (state.viewMode === "card") {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      feed.scrollBy({ top: feed.clientHeight, behavior: "smooth" });
    }
    if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      feed.scrollBy({ top: -feed.clientHeight, behavior: "smooth" });
    }
  }
  if (e.key === "s" || e.key === "S") {
    const currentJob = state.jobs[state.currentIndex];
    if (currentJob) {
      const saveBtn = feed.querySelector(`[data-job-id="${currentJob.id}"] .save-btn`);
      handleSave(currentJob.id, saveBtn);
    }
  }
  if (e.key === "Enter") {
    const currentJob = state.jobs[state.currentIndex];
    if (currentJob) openDetail(currentJob.id);
  }
});

// ─── AI 사용량 & 요금 ────────────────────────────────────
function getAiUsageData() {
  const stored = JSON.parse(localStorage.getItem("aiUsageData") || "null");
  if (stored) return stored;
  // 초기 데모 데이터 생성
  const now = new Date();
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    daily.push({
      date: d.toISOString().slice(0, 10),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      requests: Math.floor(Math.random() * 40) + 5,
      tokens: Math.floor(Math.random() * 8000) + 1000,
    });
  }
  const totalReq = daily.reduce((s, d) => s + d.requests, 0);
  const totalTokens = daily.reduce((s, d) => s + d.tokens, 0);
  const sonnetReq = Math.floor(totalReq * 0.55);
  const haikuReq = Math.floor(totalReq * 0.35);
  const opusReq = totalReq - sonnetReq - haikuReq;
  const data = {
    plan: "Free",
    planName: "무료 체험",
    totalRequests: totalReq,
    totalTokens,
    requestLimit: 1000,
    tokenLimit: 100000,
    avgResponseMs: Math.floor(Math.random() * 300) + 150,
    models: {
      sonnet: { count: sonnetReq, cost: +(sonnetReq * 0.003).toFixed(2) },
      opus: { count: opusReq, cost: +(opusReq * 0.015).toFixed(2) },
      haiku: { count: haikuReq, cost: +(haikuReq * 0.00025).toFixed(2) },
    },
    daily,
  };
  data.totalCost = +(data.models.sonnet.cost + data.models.opus.cost + data.models.haiku.cost).toFixed(2);
  localStorage.setItem("aiUsageData", JSON.stringify(data));
  return data;
}

function renderAiUsage() {
  const data = getAiUsageData();

  // 요금제
  document.getElementById("aiPlanBadge").textContent = data.plan;
  document.getElementById("aiPlanName").textContent = data.planName;

  // 요약
  document.getElementById("aiTotalRequests").textContent = data.totalRequests.toLocaleString();
  document.getElementById("aiTotalTokens").textContent = data.totalTokens >= 1000 ? (data.totalTokens / 1000).toFixed(1) + "K" : data.totalTokens;
  document.getElementById("aiTotalCost").textContent = "$" + data.totalCost.toFixed(2);
  document.getElementById("aiAvgResponse").textContent = data.avgResponseMs + "ms";

  // 게이지
  const reqPct = Math.min(100, (data.totalRequests / data.requestLimit) * 100);
  const tokenPct = Math.min(100, (data.totalTokens / data.tokenLimit) * 100);
  document.getElementById("aiReqGauge").style.width = reqPct + "%";
  document.getElementById("aiReqUsed").textContent = `${data.totalRequests.toLocaleString()} / ${data.requestLimit.toLocaleString()}`;
  document.getElementById("aiTokenGauge").style.width = tokenPct + "%";
  document.getElementById("aiTokenUsed").textContent = `${(data.totalTokens / 1000).toFixed(1)}K / ${data.tokenLimit / 1000}K`;

  // 모델별
  document.getElementById("aiSonnetCount").textContent = data.models.sonnet.count + "회";
  document.getElementById("aiSonnetCost").textContent = "$" + data.models.sonnet.cost.toFixed(2);
  document.getElementById("aiOpusCount").textContent = data.models.opus.count + "회";
  document.getElementById("aiOpusCost").textContent = "$" + data.models.opus.cost.toFixed(2);
  document.getElementById("aiHaikuCount").textContent = data.models.haiku.count + "회";
  document.getElementById("aiHaikuCost").textContent = "$" + data.models.haiku.cost.toFixed(2);

  // 차트
  const maxReq = Math.max(...data.daily.map((d) => d.requests), 1);
  const barsEl = document.getElementById("aiChartBars");
  const labelsEl = document.getElementById("aiChartLabels");
  barsEl.innerHTML = data.daily.map((d) => {
    const h = Math.max(4, (d.requests / maxReq) * 100);
    return `<div class="ai-chart-bar" style="height:${h}%" title="${d.date}: ${d.requests}회"><span class="ai-chart-val">${d.requests}</span></div>`;
  }).join("");
  labelsEl.innerHTML = data.daily.map((d) => `<span>${d.label}</span>`).join("");

  // 현재 요금제 표시
  document.querySelectorAll(".ai-pricing-card").forEach((card) => card.classList.remove("current"));
  document.querySelectorAll(".ai-pricing-btn").forEach((btn) => { btn.disabled = false; btn.classList.remove("current"); btn.textContent = btn.textContent.replace("현재 요금제", "선택"); });
  const cards = document.querySelectorAll(".ai-pricing-card");
  const planIdx = data.plan === "Free" ? 0 : data.plan === "Pro" ? 1 : 2;
  if (cards[planIdx]) {
    cards[planIdx].classList.add("current");
    const btn = cards[planIdx].querySelector(".ai-pricing-btn");
    if (btn) { btn.disabled = true; btn.classList.add("current"); btn.textContent = "현재 요금제"; }
  }
}

// ─── 초기 nav badge 업데이트 ─────────────────────────────
updateNavBadges();

// ─── Service Worker 등록 (PWA) ───────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW 등록 실패:", err));
  });
}
