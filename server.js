const express = require("express");
const path = require("path");
const cors = require("cors");
const mockData = require("./mockData");
const { crawlAll } = require("./crawler");
const { saveJobs, loadJobs, mergeJobs } = require("./storage");

const app = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── 설정 ─────────────────────────────────────────────
const WORKNET_API_KEY = process.env.WORKNET_API_KEY || "";
const CRAWL_INTERVAL_MS = parseInt(process.env.CRAWL_INTERVAL || "3600000", 10); // 기본 1시간
const SARAMIN_PAGES = parseInt(process.env.SARAMIN_PAGES || "3", 10);
const JOBKOREA_PAGES = parseInt(process.env.JOBKOREA_PAGES || "3", 10);
const WORKNET_PAGES = parseInt(process.env.WORKNET_PAGES || "5", 10);
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Rate Limiting ────────────────────────────────────
const requestCounts = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count++;
  }

  requestCounts.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." });
  }
  next();
}

app.use("/api", rateLimiter);

// ── 크롤링 데이터 (파일에서 복원) ────────────────────
let crawledCache = [];
let lastCrawledAt = null;
let crawlSources = {};
let isCrawling = false;
let schedulerHandle = null;

// 서버 시작 시 저장된 데이터 복원
function restoreFromDisk() {
  const { jobs, meta } = loadJobs();
  if (jobs.length > 0) {
    crawledCache = jobs;
    lastCrawledAt = meta.lastCrawledAt || null;
    crawlSources = meta.sources || {};
    console.log(`📂 저장된 데이터 복원: ${jobs.length}개 공고 (마지막 크롤링: ${lastCrawledAt || "없음"})`);
  }
}

// ── 크롤링 실행 함수 ─────────────────────────────────
async function runCrawl(force = false) {
  if (isCrawling) {
    console.log("⏳ 이미 크롤링 진행 중, 건너뜀");
    return { skipped: true, reason: "already_running" };
  }

  // 캐시 유효하면 건너뜀 (강제 실행이 아닌 경우)
  if (!force && lastCrawledAt && Date.now() - lastCrawledAt < CACHE_TTL_MS) {
    console.log("⏳ 캐시 유효, 크롤링 건너뜀");
    return { skipped: true, reason: "cache_valid", count: crawledCache.length };
  }

  isCrawling = true;

  try {
    const result = await crawlAll({
      saraminPages: SARAMIN_PAGES,
      jobkoreaPages: JOBKOREA_PAGES,
      worknetPages: WORKNET_PAGES,
      worknetApiKey: WORKNET_API_KEY,
    });

    // 기존 데이터와 병합 (중복 제거)
    crawledCache = mergeJobs(crawledCache, result.jobs);
    lastCrawledAt = Date.now();
    crawlSources = result.sources;

    // 파일에 저장
    saveJobs(crawledCache, {
      lastCrawledAt,
      sources: crawlSources,
      totalMerged: crawledCache.length,
    });

    console.log(`💾 저장 완료: 총 ${crawledCache.length}개 공고 (신규 ${result.jobs.length}개)`);

    return {
      skipped: false,
      newCount: result.jobs.length,
      totalCount: crawledCache.length,
      sources: crawlSources,
    };
  } catch (err) {
    console.error("❌ 크롤링 실패:", err.message);
    throw err;
  } finally {
    isCrawling = false;
  }
}

// ── 자동 스케줄러 ────────────────────────────────────
function startScheduler() {
  const intervalMin = Math.round(CRAWL_INTERVAL_MS / 60000);
  console.log(`⏰ 자동 크롤링 스케줄러 시작: ${intervalMin}분 간격`);

  // 서버 시작 30초 후 첫 크롤링
  setTimeout(() => {
    console.log("🔄 초기 크롤링 실행...");
    runCrawl(false).catch((e) => console.error("초기 크롤링 오류:", e.message));
  }, 30 * 1000);

  // 이후 주기적 크롤링
  schedulerHandle = setInterval(() => {
    console.log("🔄 정기 크롤링 실행...");
    runCrawl(false).catch((e) => console.error("정기 크롤링 오류:", e.message));
  }, CRAWL_INTERVAL_MS);
}

function stopScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
    console.log("⏰ 자동 크롤링 스케줄러 중지");
  }
}

// ── 연봉 파싱 헬퍼 ──────────────────────────────────
function parseSalaryMin(salaryStr) {
  if (!salaryStr) return 0;
  const match = salaryStr.match(/(\d[\d,]*)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

// ── API 엔드포인트 ───────────────────────────────────

/**
 * GET /api/jobs
 */
app.get("/api/jobs", (req, res) => {
  const {
    category,
    keyword,
    page = 1,
    location,
    experienceLevel,
    employmentType,
    salaryMin,
    sortBy,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 5;

  let jobs = [...crawledCache, ...mockData];

  // 마감된 공고 필터 (dDay === -1)
  jobs = jobs.filter((j) => j.dDay === null || j.dDay === undefined || j.dDay >= 0);

  // 카테고리 필터
  if (category && category !== "전체") {
    jobs = jobs.filter((j) => j.category === category);
  }

  // 지역 필터
  if (location && location !== "전체") {
    jobs = jobs.filter((j) => j.locationGroup === location || j.location === location);
  }

  // 경력 수준 필터
  if (experienceLevel && experienceLevel !== "전체") {
    jobs = jobs.filter((j) => j.experienceLevel === experienceLevel);
  }

  // 고용 형태 필터
  if (employmentType && employmentType !== "전체") {
    jobs = jobs.filter((j) => j.employmentType === employmentType);
  }

  // 최소 연봉 필터 (만원 단위)
  if (salaryMin && parseInt(salaryMin, 10) > 0) {
    const minSal = parseInt(salaryMin, 10);
    jobs = jobs.filter((j) => {
      const jMin = j.salaryMin || parseSalaryMin(j.salary);
      return jMin >= minSal;
    });
  }

  // 키워드 검색
  if (keyword && keyword.trim() !== "") {
    const kw = keyword.trim().toLowerCase();
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(kw) ||
        j.company.toLowerCase().includes(kw) ||
        (j.skills && j.skills.some((s) => s.toLowerCase().includes(kw))) ||
        (j.location && j.location.toLowerCase().includes(kw)) ||
        (j.category && j.category.toLowerCase().includes(kw))
    );
  }

  // 정렬
  if (sortBy === "dDay") {
    jobs = jobs.sort((a, b) => {
      const da = a.dDay !== null && a.dDay !== undefined ? a.dDay : 999;
      const db = b.dDay !== null && b.dDay !== undefined ? b.dDay : 999;
      return da - db;
    });
  } else if (sortBy === "salary") {
    jobs = jobs.sort((a, b) => (b.salaryMin || 0) - (a.salaryMin || 0));
  } else if (sortBy === "popular") {
    jobs = jobs.sort((a, b) => ((b.likes || 0) + (b.saved || 0)) - ((a.likes || 0) + (a.saved || 0)));
  } else if (sortBy === "recent") {
    // 최근 크롤링된 것 먼저
    jobs = jobs.sort((a, b) => {
      const da = a.crawledAt ? new Date(a.crawledAt).getTime() : 0;
      const db = b.crawledAt ? new Date(b.crawledAt).getTime() : 0;
      return db - da;
    });
  }

  const total = jobs.length;
  const start = (pageNum - 1) * limit;
  const paginated = jobs.slice(start, start + limit);

  res.json({
    jobs: paginated,
    total,
    page: pageNum,
    hasMore: start + limit < total,
  });
});

/**
 * GET /api/jobs/meta
 */
app.get("/api/jobs/meta", (req, res) => {
  const allJobs = [...crawledCache, ...mockData];

  const categories = ["전체", ...new Set(allJobs.map((j) => j.category).filter(Boolean))];
  const locations = ["전체", ...new Set(allJobs.map((j) => j.locationGroup || j.location).filter(Boolean))];
  const experienceLevels = ["전체", "신입", "경력"];
  const employmentTypes = ["전체", ...new Set(allJobs.map((j) => j.employmentType).filter(Boolean))];

  res.json({ categories, locations, experienceLevels, employmentTypes });
});

/**
 * POST /api/crawl — 수동 크롤링 트리거
 */
app.post("/api/crawl", async (req, res) => {
  const force = req.body.force === true;

  try {
    const result = await runCrawl(force);

    if (result.skipped) {
      return res.json({
        success: true,
        cached: true,
        reason: result.reason,
        count: result.count || crawledCache.length,
        lastCrawledAt,
      });
    }

    res.json({
      success: true,
      cached: false,
      newCount: result.newCount,
      totalCount: result.totalCount,
      sources: result.sources,
      lastCrawledAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crawl/status — 크롤링 상태
 */
app.get("/api/crawl/status", (req, res) => {
  res.json({
    crawledCount: crawledCache.length,
    mockCount: mockData.length,
    total: crawledCache.length + mockData.length,
    lastCrawledAt,
    cacheValid: lastCrawledAt ? Date.now() - lastCrawledAt < CACHE_TTL_MS : false,
    isCrawling,
    schedulerActive: schedulerHandle !== null,
    sources: crawlSources,
    intervalMinutes: Math.round(CRAWL_INTERVAL_MS / 60000),
  });
});

/**
 * POST /api/crawl/force — 강제 크롤링 (캐시 무시)
 */
app.post("/api/crawl/force", async (req, res) => {
  try {
    const result = await runCrawl(true);

    if (result.skipped) {
      return res.json({ success: false, reason: result.reason });
    }

    res.json({
      success: true,
      newCount: result.newCount,
      totalCount: result.totalCount,
      sources: result.sources,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/crawl/cache — 크롤링 캐시 초기화
 */
app.delete("/api/crawl/cache", (req, res) => {
  crawledCache = [];
  lastCrawledAt = null;
  crawlSources = {};
  saveJobs([], { lastCrawledAt: null, sources: {} });
  res.json({ success: true, message: "캐시 초기화 완료" });
});

/**
 * GET /api/ai/usage
 * AI 사용량 및 요금 정보
 */
app.get("/api/ai/usage", (req, res) => {
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

  res.json({
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
    totalCost: +(sonnetReq * 0.003 + opusReq * 0.015 + haikuReq * 0.00025).toFixed(2),
  });
});

// ── 서버 시작 ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 JobScroll 서버 실행 중`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → 목업 데이터: ${mockData.length}개 공고 로드됨`);

  // 파일에서 이전 데이터 복원
  restoreFromDisk();

  // 자동 크롤링 스케줄러 시작
  startScheduler();

  console.log(`   → 워크넷 API: ${WORKNET_API_KEY ? "설정됨" : "미설정 (WORKNET_API_KEY 환경변수 필요)"}`);
  console.log(`   → 크롤링 간격: ${Math.round(CRAWL_INTERVAL_MS / 60000)}분\n`);
});

// graceful shutdown
process.on("SIGINT", () => {
  stopScheduler();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopScheduler();
  process.exit(0);
});
