const express = require("express");
const path = require("path");
const cors = require("cors");
const mockData = require("./mockData");
const { crawlSaramin, crawlJobkorea } = require("./crawler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

// ── 크롤링 캐시 ──────────────────────────────────────
let crawledCache = [];
let lastCrawledAt = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── 연봉 파싱 헬퍼 ──────────────────────────────────
function parseSalaryMin(salaryStr) {
  if (!salaryStr) return 0;
  const match = salaryStr.match(/(\d[\d,]*)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

/**
 * GET /api/jobs
 * 쿼리: category, keyword, page, location, experienceLevel, employmentType, salaryMin, sortBy
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

  let jobs = crawledCache.length > 0 ? [...crawledCache, ...mockData] : [...mockData];

  // 마감된 공고 필터 (dDay === -1)
  jobs = jobs.filter((j) => j.dDay === null || j.dDay >= 0);

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
      const da = a.dDay !== null ? a.dDay : 999;
      const db = b.dDay !== null ? b.dDay : 999;
      return da - db;
    });
  } else if (sortBy === "salary") {
    jobs = jobs.sort((a, b) => (b.salaryMin || 0) - (a.salaryMin || 0));
  } else if (sortBy === "popular") {
    jobs = jobs.sort((a, b) => (b.likes + b.saved) - (a.likes + a.saved));
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
 * 필터 옵션 목록 (카테고리, 지역, 경력, 고용 형태)
 */
app.get("/api/jobs/meta", (req, res) => {
  const allJobs = crawledCache.length > 0 ? [...crawledCache, ...mockData] : [...mockData];

  const categories = ["전체", ...new Set(allJobs.map((j) => j.category).filter(Boolean))];
  const locations = ["전체", ...new Set(allJobs.map((j) => j.locationGroup || j.location).filter(Boolean))];
  const experienceLevels = ["전체", "신입", "경력"];
  const employmentTypes = ["전체", ...new Set(allJobs.map((j) => j.employmentType).filter(Boolean))];

  res.json({ categories, locations, experienceLevels, employmentTypes });
});

/**
 * POST /api/crawl
 */
app.post("/api/crawl", async (req, res) => {
  if (lastCrawledAt && Date.now() - lastCrawledAt < CACHE_TTL_MS) {
    return res.json({
      success: true,
      cached: true,
      count: crawledCache.length,
      lastCrawledAt,
    });
  }

  try {
    console.log("🕷️  크롤링 시작...");
    const [saraminJobs, jobkoreaJobs] = await Promise.allSettled([
      crawlSaramin(1),
      crawlJobkorea(),
    ]);

    const newJobs = [
      ...(saraminJobs.status === "fulfilled" ? saraminJobs.value : []),
      ...(jobkoreaJobs.status === "fulfilled" ? jobkoreaJobs.value : []),
    ];

    crawledCache = newJobs;
    lastCrawledAt = Date.now();

    console.log(`✅ 크롤링 완료: ${newJobs.length}개 공고 수집`);
    res.json({ success: true, cached: false, count: newJobs.length });
  } catch (err) {
    console.error("❌ 크롤링 실패:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/crawl/status
 */
app.get("/api/crawl/status", (req, res) => {
  res.json({
    crawledCount: crawledCache.length,
    mockCount: mockData.length,
    total: crawledCache.length + mockData.length,
    lastCrawledAt,
    cacheValid: lastCrawledAt ? Date.now() - lastCrawledAt < CACHE_TTL_MS : false,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 JobScroll 서버 실행 중`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → 목업 데이터: ${mockData.length}개 공고 로드됨\n`);
});
