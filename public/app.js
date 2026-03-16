/* =====================================================
   JobScroll — Instagram Stories 네비게이션 로직
   탭 우측 → 다음 슬라이드 / 탭 좌측 → 이전 슬라이드
   우 스와이프 → 공고 묶음 건너뜀 / 좌 스와이프 → 이전 묶음
   ===================================================== */

const API_BASE = "";
const SLIDES = 3; // 공고당 슬라이드 수

// ─── 상태 ────────────────────────────────────────────
const state = {
  jobs: [],
  jobIndex: 0,
  slideIndex: 0,
  loading: false,
  hasMore: true,
  page: 1,
  category: "전체",
  keyword: "",
  isAnimating: false,
  likedIds: new Set(JSON.parse(localStorage.getItem("likedIds") || "[]")),
  savedJobs: JSON.parse(localStorage.getItem("savedJobs") || "[]"),
  viewedCount: parseInt(localStorage.getItem("viewedCount") || "0", 10),
};

// ─── DOM ─────────────────────────────────────────────
const storiesVp      = document.getElementById("storiesVp");
const storyBg        = document.getElementById("storyBg");
const storyProgress  = document.getElementById("storyProgress");
const storyLogo      = document.getElementById("storyLogo");
const storyCompanyName = document.getElementById("storyCompanyName");
const storyCompanySub  = document.getElementById("storyCompanySub");
const storyCategoryBadge = document.getElementById("storyCategoryBadge");
const storyContent   = document.getElementById("storyContent");
const jobCounter     = document.getElementById("jobCounter");
const likeBtn        = document.getElementById("likeBtn");
const likeIcon       = document.getElementById("likeIcon");
const likeCount      = document.getElementById("likeCount");
const saveBtn        = document.getElementById("saveBtn");
const saveIcon       = document.getElementById("saveIcon");
const saveLabel      = document.getElementById("saveLabel");
const shareBtn       = document.getElementById("shareBtn");
const tapLeft        = document.getElementById("tapLeft");
const tapRight       = document.getElementById("tapRight");
const swipeFlash     = document.getElementById("swipeFlash");
const storyStateOverlay = document.getElementById("storyStateOverlay");
const stateBox       = document.getElementById("stateBox");
const filterBtn      = document.getElementById("filterBtn");
const filterOverlay  = document.getElementById("filterOverlay");
const filterClose    = document.getElementById("filterClose");
const filterCats     = document.getElementById("filterCats");
const filterKeyword  = document.getElementById("filterKeyword");
const filterApply    = document.getElementById("filterApply");
const crawlBtn       = document.getElementById("crawlBtn");
const crawlOverlay   = document.getElementById("crawlOverlay");
const toast          = document.getElementById("toast");
const savedPanel     = document.getElementById("savedPanel");
const profilePanel   = document.getElementById("profilePanel");
const savedList      = document.getElementById("savedList");
const savedCountBadge = document.getElementById("savedCountBadge");
const statViewed     = document.getElementById("statViewed");
const statLiked      = document.getElementById("statLiked");
const statSaved      = document.getElementById("statSaved");

// ─── 초기화 ──────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  showLoading();
  loadJobs();
  renderSavedList();
  updateStats();
  setupGestures();
});

// ─── 공고 로드 ───────────────────────────────────────
async function loadJobs(reset = false) {
  if (state.loading) return;
  if (!reset && !state.hasMore) return;

  state.loading = true;

  if (reset) {
    state.jobs = [];
    state.page = 1;
    state.hasMore = true;
    state.jobIndex = 0;
    state.slideIndex = 0;
    showLoading();
  }

  try {
    const params = new URLSearchParams({
      page: state.page,
      ...(state.category !== "전체" && { category: state.category }),
      ...(state.keyword && { keyword: state.keyword }),
    });

    const res = await fetch(`${API_BASE}/api/jobs?${params}`);
    const data = await res.json();

    if (data.jobs.length === 0 && state.page === 1) {
      showEmpty();
    } else {
      data.jobs.forEach((j) => state.jobs.push(j));
      state.hasMore = data.hasMore;
      state.page++;
      hideStateOverlay();
      renderCurrentState("bundle");
    }
  } catch (err) {
    console.error("공고 로드 실패:", err);
    showToast("데이터를 불러오는 중 오류가 발생했어요.");
    hideStateOverlay();
  } finally {
    state.loading = false;
  }
}

// ─── 현재 상태 렌더 ──────────────────────────────────
function renderCurrentState(direction = "right") {
  const job = state.jobs[state.jobIndex];
  if (!job) return;

  updateBackground(job);
  updateHeader(job);
  updateProgress();
  updateCounter();
  updateActionButtons(job);
  renderSlide(job, state.slideIndex, direction);
}

// ─── 배경 업데이트 ───────────────────────────────────
function updateBackground(job) {
  storyBg.style.background = job.gradient;
}

// ─── 헤더 업데이트 ───────────────────────────────────
function updateHeader(job) {
  storyLogo.textContent = job.logoText;
  storyCompanyName.textContent = job.company;
  const meta = [job.location, job.dDay != null ? `D-${job.dDay}` : job.deadline].filter(Boolean).join(" · ");
  storyCompanySub.textContent = meta;
  storyCategoryBadge.textContent = job.category || "";
}

// ─── 진행 표시바 업데이트 ────────────────────────────
function updateProgress() {
  storyProgress.innerHTML = "";
  for (let i = 0; i < SLIDES; i++) {
    const seg = document.createElement("div");
    seg.className = "prog-seg";
    if (i < state.slideIndex) seg.classList.add("done");
    else if (i === state.slideIndex) seg.classList.add("active");
    storyProgress.appendChild(seg);
  }
}

// ─── 카운터 업데이트 ─────────────────────────────────
function updateCounter() {
  jobCounter.textContent = `${state.jobIndex + 1} / ${state.jobs.length}${state.hasMore ? "+" : ""}`;
}

// ─── 액션 버튼 업데이트 ──────────────────────────────
function updateActionButtons(job) {
  const isLiked = state.likedIds.has(job.id);
  const isSaved = state.savedJobs.some((j) => j.id === job.id);

  likeBtn.classList.toggle("liked", isLiked);
  likeIcon.textContent = isLiked ? "❤️" : "🤍";
  likeCount.textContent = formatNum(job.likes + (isLiked ? 1 : 0));

  saveBtn.classList.toggle("saved", isSaved);
  saveIcon.textContent = isSaved ? "🔖" : "📌";
  saveLabel.textContent = isSaved ? "저장됨" : "저장";
}

// ─── 슬라이드 렌더 ───────────────────────────────────
function renderSlide(job, slideIdx, direction = "right") {
  const animClass = direction === "left"
    ? "slide-enter-left"
    : direction === "bundle"
    ? "slide-enter-bundle"
    : "slide-enter-right";

  storyContent.className = animClass;
  storyContent.innerHTML = `<div class="slide-inner">${getSlideHTML(job, slideIdx)}</div>`;

  // 슬라이드 마지막이면 지원 버튼 pointer-events 허용
  const inner = storyContent.querySelector(".slide-inner");
  if (inner) inner.style.pointerEvents = slideIdx === SLIDES - 1 ? "auto" : "none";
}

// ─── 슬라이드 HTML 생성 ──────────────────────────────
function getSlideHTML(job, slideIdx) {
  switch (slideIdx) {
    case 0: return slide0HTML(job);
    case 1: return slide1HTML(job);
    case 2: return slide2HTML(job);
    default: return slide0HTML(job);
  }
}

function slide0HTML(job) {
  const skillsHTML = (job.skills || [])
    .slice(0, 5)
    .map((s) => `<span class="skill-tag">${esc(s)}</span>`)
    .join("");

  return `
    <div class="slide-overview">
      <p class="slide-label">📋 개요</p>
      <h1 class="slide-job-title">${esc(job.title)}</h1>
      ${job.department ? `<p class="slide-dept">${esc(job.department)}</p>` : ""}
      <div class="meta-row">
        <span class="meta-chip">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          ${esc(job.location)}
        </span>
        <span class="meta-chip">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          ${esc(job.salary)}
        </span>
        <span class="meta-chip">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          ${esc(job.experience)}
        </span>
      </div>
      ${skillsHTML ? `<div class="skills-row">${skillsHTML}</div>` : ""}
    </div>`;
}

function slide1HTML(job) {
  const tasksHTML = (job.mainTasks || [])
    .slice(0, 4)
    .map((t) => `<div class="task-item"><div class="task-dot"></div><span>${esc(t)}</span></div>`)
    .join("");

  return `
    <div class="slide-tasks">
      <p class="slide-section-title">💼 주요 업무</p>
      <div class="task-list">${tasksHTML}</div>
      <div class="slide-nav-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        우측 탭 → 복지 & 지원
      </div>
    </div>`;
}

function slide2HTML(job) {
  const benefitsHTML = (job.benefits || [])
    .slice(0, 5)
    .map((b) => `<span class="benefit-chip">✓ ${esc(b)}</span>`)
    .join("");

  const isUrgent = job.dDay != null && job.dDay <= 7;
  const deadlineColor = isUrgent ? "#ff6b6b" : "rgba(255,255,255,0.55)";
  const deadlineText = job.dDay != null ? `마감 D-${job.dDay}` : job.deadline;

  return `
    <div class="slide-benefits">
      <p class="slide-section-title">🎁 복리후생</p>
      <div class="benefits-grid">${benefitsHTML}</div>
      <div class="deadline-row">
        <div class="deadline-dot" style="background:${deadlineColor}"></div>
        <span class="deadline-text" style="color:${deadlineColor}">${esc(deadlineText)}</span>
      </div>
      <button class="big-apply-btn" onclick="handleApply()">
        지원하기 →
      </button>
    </div>`;
}

// ─── 네비게이션: 슬라이드 ────────────────────────────
function tapRight_handler() {
  if (state.isAnimating) return;
  if (state.slideIndex < SLIDES - 1) {
    state.slideIndex++;
    updateProgress();
    renderSlide(state.jobs[state.jobIndex], state.slideIndex, "right");
  } else {
    nextBundle();
  }
}

function tapLeft_handler() {
  if (state.isAnimating) return;
  if (state.slideIndex > 0) {
    state.slideIndex--;
    updateProgress();
    renderSlide(state.jobs[state.jobIndex], state.slideIndex, "left");
  } else {
    prevBundle();
  }
}

// ─── 네비게이션: 묶음 (Bundle) ───────────────────────
function nextBundle() {
  if (state.isAnimating) return;
  const nextIdx = state.jobIndex + 1;

  if (nextIdx >= state.jobs.length) {
    if (state.hasMore) {
      loadJobs();
    } else {
      showEnd();
    }
    return;
  }

  state.isAnimating = true;
  state.jobIndex = nextIdx;
  state.slideIndex = 0;

  if (nextIdx >= state.jobs.length - 2 && state.hasMore) {
    loadJobs();
  }

  trackViewed();
  renderCurrentState("bundle");
  setTimeout(() => { state.isAnimating = false; }, 380);
}

function prevBundle() {
  if (state.isAnimating || state.jobIndex === 0) {
    if (state.jobIndex === 0) showToast("첫 번째 공고예요!");
    return;
  }
  state.isAnimating = true;
  state.jobIndex--;
  state.slideIndex = 0;

  renderCurrentState("left");
  setTimeout(() => { state.isAnimating = false; }, 380);
}

// 우 스와이프: 현재 묶음 건너뛰고 다음으로 (skip)
function skipBundle() {
  triggerFlash("right");
  nextBundle();
}

// 좌 스와이프: 이전 묶음으로
function goToPrevBundle() {
  triggerFlash("left");
  prevBundle();
}

function triggerFlash(dir) {
  swipeFlash.className = "swipe-flash flash-" + dir;
  setTimeout(() => { swipeFlash.className = "swipe-flash"; }, 320);
}

function trackViewed() {
  if (state.jobIndex > state.viewedCount) {
    state.viewedCount = state.jobIndex;
    localStorage.setItem("viewedCount", state.viewedCount);
    updateStats();
  }
}

// ─── 제스처 감지 (터치 + 마우스) ────────────────────
function setupGestures() {
  let startX = 0, startY = 0, startTime = 0;
  let dragging = false;

  function onStart(e) {
    const pt = e.touches ? e.touches[0] : e;
    startX = pt.clientX;
    startY = pt.clientY;
    startTime = Date.now();
    dragging = true;
  }

  function onEnd(e) {
    if (!dragging) return;
    dragging = false;

    // 버튼/인풋 영역은 무시
    if (e.target.closest(".story-actions, .big-apply-btn, .filter-overlay, .side-panel, .bottom-nav, .top-bar")) return;

    const pt = e.changedTouches ? e.changedTouches[0] : e;
    const dx = pt.clientX - startX;
    const dy = pt.clientY - startY;
    const dt = Date.now() - startTime;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const SWIPE_DIST = 60;
    const TAP_DIST   = 14;
    const SWIPE_TIME = 450;

    if (absDx < TAP_DIST && absDy < TAP_DIST) {
      // ── 탭 ──
      const vpRect = storiesVp.getBoundingClientRect();
      const relX = pt.clientX - vpRect.left;
      const vpW  = vpRect.width;

      if (relX < vpW * 0.40) {
        tapLeft_handler();
      } else {
        tapRight_handler();
      }
    } else if (absDx > SWIPE_DIST && absDx > absDy * 1.4 && dt < SWIPE_TIME) {
      // ── 수평 스와이프 ──
      if (dx > 0) {
        skipBundle();     // 우 스와이프 → 다음 묶음 건너뜀
      } else {
        goToPrevBundle(); // 좌 스와이프 → 이전 묶음
      }
    }
  }

  // 터치 이벤트
  storiesVp.addEventListener("touchstart", onStart, { passive: true });
  storiesVp.addEventListener("touchend",   onEnd,   { passive: true });

  // 마우스 이벤트 (데스크탑)
  storiesVp.addEventListener("mousedown", onStart);
  storiesVp.addEventListener("mouseup",   onEnd);
}

// ─── 액션 핸들러 ─────────────────────────────────────
likeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const job = state.jobs[state.jobIndex];
  if (!job) return;

  if (state.likedIds.has(job.id)) {
    state.likedIds.delete(job.id);
    showToast("좋아요를 취소했어요");
  } else {
    state.likedIds.add(job.id);
    likeIcon.classList.add("pulse");
    likeIcon.addEventListener("animationend", () => likeIcon.classList.remove("pulse"), { once: true });
    showToast("❤️ 좋아요!");
  }
  localStorage.setItem("likedIds", JSON.stringify([...state.likedIds]));
  updateActionButtons(job);
  updateStats();
});

saveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const job = state.jobs[state.jobIndex];
  if (!job) return;

  const already = state.savedJobs.some((j) => j.id === job.id);
  if (already) {
    state.savedJobs = state.savedJobs.filter((j) => j.id !== job.id);
    showToast("저장 목록에서 제거됐어요");
  } else {
    state.savedJobs.push(job);
    saveIcon.classList.add("pulse");
    saveIcon.addEventListener("animationend", () => saveIcon.classList.remove("pulse"), { once: true });
    showToast("🔖 저장 목록에 추가됐어요!");
  }
  localStorage.setItem("savedJobs", JSON.stringify(state.savedJobs));
  updateActionButtons(job);
  renderSavedList();
  updateStats();
});

shareBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const job = state.jobs[state.jobIndex];
  if (!job) return;
  const text = `${job.company} — ${job.title} 공고를 JobScroll에서 발견했어요!`;
  if (navigator.share) {
    navigator.share({ title: job.title, text, url: window.location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text)
      .then(() => showToast("📤 클립보드에 복사됐어요!"))
      .catch(() => showToast("공유 기능을 지원하지 않는 브라우저예요."));
  }
});

function handleApply() {
  const job = state.jobs[state.jobIndex];
  if (!job) return;
  if (job.url && job.url !== "#") {
    window.open(job.url, "_blank");
  } else {
    showToast("🔗 실제 서비스에서는 채용 사이트로 연결됩니다");
  }
}

// ─── 크롤링 ──────────────────────────────────────────
crawlBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  crawlOverlay.classList.add("active");
  try {
    const res = await fetch(`${API_BASE}/api/crawl`, { method: "POST" });
    const data = await res.json();
    crawlOverlay.classList.remove("active");
    if (data.success) {
      showToast(data.cached ? `✅ 캐시 데이터 (${data.count}개)` : `✅ ${data.count}개 공고 수집 완료!`);
      loadJobs(true);
    } else {
      showToast("크롤링 실패 — 목업 데이터를 사용합니다.");
    }
  } catch {
    crawlOverlay.classList.remove("active");
    showToast("서버 연결 실패");
  }
});

// ─── 필터 패널 ───────────────────────────────────────
filterBtn.addEventListener("click", (e) => { e.stopPropagation(); openFilter(); });
filterClose.addEventListener("click", closeFilter);
filterOverlay.addEventListener("click", (e) => { if (e.target === filterOverlay) closeFilter(); });

function openFilter() {
  filterKeyword.value = state.keyword;
  filterOverlay.classList.add("open");
}
function closeFilter() {
  filterOverlay.classList.remove("open");
}

filterCats.addEventListener("click", (e) => {
  const btn = e.target.closest(".fcat-btn");
  if (!btn) return;
  filterCats.querySelectorAll(".fcat-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

filterApply.addEventListener("click", () => {
  const activeBtn = filterCats.querySelector(".fcat-btn.active");
  state.category = activeBtn ? activeBtn.dataset.category : "전체";
  state.keyword = filterKeyword.value.trim();
  closeFilter();
  loadJobs(true);
});

// ─── 하단 내비게이션 ─────────────────────────────────
document.querySelectorAll(".bnav-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const tab = btn.dataset.tab;
    document.querySelectorAll(".bnav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    savedPanel.classList.remove("active");
    profilePanel.classList.remove("active");

    if (tab === "saved") { savedPanel.classList.add("active"); }
    else if (tab === "profile") { updateStats(); profilePanel.classList.add("active"); }
  });
});

// ─── 저장 목록 ───────────────────────────────────────
function renderSavedList() {
  savedCountBadge.textContent = state.savedJobs.length;

  if (state.savedJobs.length === 0) {
    savedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔖</div>
        <p>저장한 공고가 없어요.<br/>마음에 드는 공고를 저장해 보세요!</p>
      </div>`;
    return;
  }

  savedList.innerHTML = state.savedJobs.map((job) => `
    <div class="saved-item" onclick="jumpToJob(${job.id})">
      <div class="saved-item__logo" style="background:${getFirstColor(job.gradient)};">${esc(job.logoText)}</div>
      <div class="saved-item__info">
        <p class="saved-item__company">${esc(job.company)}</p>
        <p class="saved-item__title">${esc(job.title)}</p>
        <p class="saved-item__meta">${esc(job.location)} · ${esc(job.experience)}</p>
      </div>
      <button class="saved-item__remove" onclick="removeSaved(event,${job.id})">✕</button>
    </div>`
  ).join("");
}

function removeSaved(event, jobId) {
  event.stopPropagation();
  state.savedJobs = state.savedJobs.filter((j) => j.id !== jobId);
  localStorage.setItem("savedJobs", JSON.stringify(state.savedJobs));
  renderSavedList();
  updateStats();
  const curJob = state.jobs[state.jobIndex];
  if (curJob && curJob.id === jobId) updateActionButtons(curJob);
  showToast("저장 목록에서 제거됐어요");
}

function jumpToJob(jobId) {
  const idx = state.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) { showToast("현재 피드에 없는 공고예요"); return; }
  savedPanel.classList.remove("active");
  document.querySelectorAll(".bnav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === "feed"));
  state.jobIndex = idx;
  state.slideIndex = 0;
  renderCurrentState("bundle");
}

// ─── 통계 ────────────────────────────────────────────
function updateStats() {
  statViewed.textContent = state.viewedCount;
  statLiked.textContent  = state.likedIds.size;
  statSaved.textContent  = state.savedJobs.length;
}

// ─── 상태 오버레이 ────────────────────────────────────
function showLoading() {
  stateBox.innerHTML = `
    <div class="state-spinner"></div>
    <p class="state-title">공고 불러오는 중...</p>`;
  storyStateOverlay.style.display = "flex";
}

function showEmpty() {
  stateBox.innerHTML = `
    <div class="state-emoji">🔍</div>
    <p class="state-title">검색 결과가 없어요</p>
    <p class="state-sub">다른 키워드나 카테고리로 검색해 보세요.</p>
    <button class="state-restart-btn" onclick="resetAndReload()">전체 공고 보기</button>`;
  storyStateOverlay.style.display = "flex";
}

function showEnd() {
  stateBox.innerHTML = `
    <div class="state-emoji">🎉</div>
    <p class="state-title">모든 공고를 탐색했어요!</p>
    <p class="state-sub">총 ${state.jobs.length}개 공고를 모두 봤어요.<br/>저장한 공고를 확인해 지원해 보세요.</p>
    <button class="state-restart-btn" onclick="restartFeed()">처음부터 다시 보기</button>`;
  storyStateOverlay.style.display = "flex";
}

function hideStateOverlay() {
  storyStateOverlay.style.display = "none";
}

function restartFeed() {
  state.jobIndex = 0;
  state.slideIndex = 0;
  hideStateOverlay();
  renderCurrentState("bundle");
}

function resetAndReload() {
  state.category = "전체";
  state.keyword = "";
  filterCats.querySelectorAll(".fcat-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.category === "전체");
  });
  loadJobs(true);
}

// ─── 토스트 ──────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ─── 유틸 ────────────────────────────────────────────
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n || 0);
}

function getFirstColor(gradient) {
  const m = gradient.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : "#6c63ff";
}
