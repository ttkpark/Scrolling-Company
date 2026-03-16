/**
 * 브라우저 디버깅 스크립트
 * 요청된 단계를 정확히 수행하고 콘솔 오류를 캡처합니다
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 브라우저 디버깅 시작...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // 브라우저를 보이게 설정
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // 콘솔 메시지 캡처
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    
    if (type === 'error') {
      console.log('❌ 콘솔 오류:', text);
      errors.push(text);
    } else {
      console.log(`[${type.toUpperCase()}]`, text);
    }
  });

  // 페이지 오류 캡처
  page.on('pageerror', error => {
    console.log('❌ JavaScript 오류:', error.message);
    errors.push(error.message);
  });

  // 네트워크 오류 캡처
  page.on('requestfailed', request => {
    console.log('❌ 네트워크 오류:', request.url(), request.failure().errorText);
    errors.push(`네트워크 실패: ${request.url()} - ${request.failure().errorText}`);
  });

  try {
    // 1단계: URL로 이동
    console.log('1️⃣ http://localhost:3000 로 이동 중...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('✅ 페이지 로드 완료\n');

    // 2단계: 4초 대기
    console.log('2️⃣ 4초 대기 중...');
    await new Promise(resolve => setTimeout(resolve, 4000));
    console.log('✅ 4초 대기 완료\n');

    // 3단계: 스크린샷 촬영
    console.log('3️⃣ 스크린샷 촬영 중...');
    const screenshotPath = path.join(__dirname, 'screenshot-page.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log('✅ 스크린샷 저장:', screenshotPath, '\n');

    // 4단계: 페이지 내용 분석
    console.log('4️⃣ 페이지 시각적 상태 분석 중...');
    const pageAnalysis = await page.evaluate(() => {
      const body = document.body;
      const feed = document.getElementById('feed');
      const cards = document.querySelectorAll('.job-card');
      const skeleton = document.getElementById('skeletonCard');
      const errorElements = document.querySelectorAll('.error, .end-card');
      
      return {
        bodyText: body.innerText.substring(0, 500),
        hasContent: body.children.length > 0,
        feedExists: !!feed,
        cardCount: cards.length,
        skeletonVisible: skeleton ? skeleton.style.display !== 'none' : false,
        hasErrors: errorElements.length > 0,
        title: document.title,
        visibleText: Array.from(document.querySelectorAll('h1, h2, .end-card, .error'))
          .map(el => el.textContent.trim())
          .filter(t => t)
          .slice(0, 5)
      };
    });

    console.log('📊 페이지 상태:');
    console.log('   - 제목:', pageAnalysis.title);
    console.log('   - 콘텐츠 존재:', pageAnalysis.hasContent ? '✅ 예' : '❌ 아니오');
    console.log('   - 피드 존재:', pageAnalysis.feedExists ? '✅ 예' : '❌ 아니오');
    console.log('   - 채용공고 카드 수:', pageAnalysis.cardCount);
    console.log('   - 스켈레톤 로딩 표시:', pageAnalysis.skeletonVisible ? '✅ 예' : '❌ 아니오');
    console.log('   - 오류 메시지:', pageAnalysis.hasErrors ? '❌ 있음' : '✅ 없음');
    
    if (pageAnalysis.visibleText.length > 0) {
      console.log('   - 표시된 텍스트:', pageAnalysis.visibleText);
    }
    console.log('');

    // 5단계: 개발자 도구 콘솔 확인 (F12 시뮬레이션)
    console.log('5️⃣ 개발자 도구 콘솔 열기 (F12)...');
    await page.keyboard.press('F12');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ 개발자 도구 열림\n');

    // 6단계: 콘솔 탭 스크린샷
    console.log('6️⃣ 콘솔 스크린샷 촬영 중...');
    const consoleScreenshot = path.join(__dirname, 'screenshot-console.png');
    await page.screenshot({ 
      path: consoleScreenshot,
      fullPage: false 
    });
    console.log('✅ 콘솔 스크린샷 저장:', consoleScreenshot, '\n');

    // 7단계: 오류 리포트
    console.log('7️⃣ 오류 리포트 생성 중...\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 최종 오류 보고서');
    console.log('═══════════════════════════════════════════════════════\n');

    if (errors.length === 0) {
      console.log('✅ 콘솔에서 발견된 오류가 없습니다!');
    } else {
      console.log(`❌ 총 ${errors.length}개의 오류 발견:\n`);
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }

    console.log('\n📊 모든 콘솔 메시지:');
    if (consoleMessages.length === 0) {
      console.log('   (콘솔 메시지 없음)');
    } else {
      consoleMessages.forEach((msg, idx) => {
        console.log(`   [${msg.type}] ${msg.text}`);
      });
    }

    // 리포트 파일로 저장
    const report = {
      timestamp: new Date().toISOString(),
      pageAnalysis,
      errors,
      consoleMessages
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'debug-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n💾 상세 리포트 저장: debug-report.json');
    console.log('═══════════════════════════════════════════════════════\n');

    // 브라우저를 열린 상태로 유지 (10초 후 자동 종료)
    console.log('⏳ 10초 후 브라우저를 자동으로 닫습니다...');
    console.log('   (수동으로 확인하려면 Ctrl+C로 중지하세요)');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ 치명적 오류 발생:', error.message);
    errors.push(`치명적 오류: ${error.message}`);
  } finally {
    await browser.close();
    console.log('✅ 디버깅 완료');
  }
})();
