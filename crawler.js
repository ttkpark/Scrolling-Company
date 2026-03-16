/**
 * 한국 채용 사이트 크롤러
 * 현재 지원: 사람인 (saramin.co.kr)
 * 실제 크롤링 시 사이트 정책을 준수해 주세요.
 */

const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xhtml+xml",
};

/**
 * 사람인에서 IT 개발 직군 채용공고를 크롤링합니다.
 * @param {number} page - 페이지 번호 (기본값: 1)
 * @returns {Promise<Array>} 채용공고 배열
 */
async function crawlSaramin(page = 1) {
  const url = `https://www.saramin.co.kr/zf_user/jobs/list/job-category?cat_kewd=84&page=${page}&sort=RD&search_optional_item=n&search_done=y&panel_count=y&isAjaxRequest=0&page_count=40&prev_url=https%3A%2F%2Fwww.saramin.co.kr`;

  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const jobs = [];

  $(".item_recruit").each((i, el) => {
    try {
      const company = $(el).find(".corp_name a").text().trim();
      const title = $(el).find(".job_tit a").text().trim();
      const conditions = [];
      $(el)
        .find(".job_condition span")
        .each((_, span) => {
          conditions.push($(span).text().trim());
        });

      const [location, experience, education, employType] = conditions;
      const deadline = $(el).find(".job_date .date").text().trim();
      const skills = [];
      $(el)
        .find(".job_sector a")
        .each((_, a) => {
          skills.push($(a).text().trim());
        });

      if (company && title) {
        jobs.push({
          id: Date.now() + i,
          company,
          logoText: company.charAt(0),
          gradient: getGradientByIndex(i),
          textOnGradient: "#fff",
          category: "IT/개발",
          title,
          department: "",
          location: location || "미기재",
          salary: "협의 가능",
          experience: experience || "경력 무관",
          skills: skills.slice(0, 5),
          mainTasks: ["상세 내용은 공고를 확인해 주세요."],
          benefits: ["채용 공고 확인"],
          deadline: deadline || "상시채용",
          dDay: null,
          views: Math.floor(Math.random() * 10000),
          likes: Math.floor(Math.random() * 300),
          saved: Math.floor(Math.random() * 100),
          source: "사람인",
          url: "https://www.saramin.co.kr",
          crawled: true,
        });
      }
    } catch (e) {
      // 파싱 오류는 건너뜁니다
    }
  });

  return jobs;
}

/**
 * 잡코리아에서 채용공고를 크롤링합니다.
 * @returns {Promise<Array>} 채용공고 배열
 */
async function crawlJobkorea() {
  const url =
    "https://www.jobkorea.co.kr/Search/?stext=개발자&tabType=recruit&Page_No=1";

  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const jobs = [];

  $(".list-post").each((i, el) => {
    try {
      const company = $(el).find(".name").text().trim();
      const title = $(el).find(".title").text().trim();
      const location = $(el).find(".etc-info .option-item").first().text().trim();
      const experience = $(el).find(".etc-info .option-item").eq(1).text().trim();
      const deadline = $(el).find(".date").text().trim();

      if (company && title) {
        jobs.push({
          id: Date.now() + i + 1000,
          company,
          logoText: company.charAt(0),
          gradient: getGradientByIndex(i + 5),
          textOnGradient: "#fff",
          category: "IT/개발",
          title,
          department: "",
          location: location || "미기재",
          salary: "협의 가능",
          experience: experience || "경력 무관",
          skills: [],
          mainTasks: ["상세 내용은 공고를 확인해 주세요."],
          benefits: ["채용 공고 확인"],
          deadline: deadline || "상시채용",
          dDay: null,
          views: Math.floor(Math.random() * 10000),
          likes: Math.floor(Math.random() * 300),
          saved: Math.floor(Math.random() * 100),
          source: "잡코리아",
          url: "https://www.jobkorea.co.kr",
          crawled: true,
        });
      }
    } catch (e) {
      // 파싱 오류는 건너뜁니다
    }
  });

  return jobs;
}

function getGradientByIndex(i) {
  const gradients = [
    "linear-gradient(145deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(145deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(145deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(145deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(145deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(145deg, #a18cd1 0%, #fbc2eb 100%)",
    "linear-gradient(145deg, #ffecd2 0%, #fcb69f 100%)",
    "linear-gradient(145deg, #ff9a9e 0%, #fecfef 100%)",
    "linear-gradient(145deg, #a1c4fd 0%, #c2e9fb 100%)",
    "linear-gradient(145deg, #d4fc79 0%, #96e6a1 100%)",
  ];
  return gradients[i % gradients.length];
}

module.exports = { crawlSaramin, crawlJobkorea };
