/**
 * Puppeteer 브라우저 풀
 *
 * 배치 동기화 병렬 처리를 위한 브라우저 인스턴스 풀
 *
 * 특징:
 * - 미리 생성된 브라우저 인스턴스 재사용
 * - 동시 처리 수 제한
 * - 자동 정리 및 재시작
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface PooledBrowser {
  browser: Browser;
  inUse: boolean;
  createdAt: Date;
  usageCount: number;
}

interface PoolConfig {
  maxBrowsers: number;        // 최대 브라우저 수
  maxUsagePerBrowser: number; // 브라우저당 최대 사용 횟수
  browserTimeout: number;     // 브라우저 타임아웃 (ms)
  pageTimeout: number;        // 페이지 타임아웃 (ms)
  headless: boolean;          // 헤드리스 모드
}

const DEFAULT_CONFIG: PoolConfig = {
  maxBrowsers: 4,
  maxUsagePerBrowser: 20,
  browserTimeout: 60000,
  pageTimeout: 30000,
  headless: true,
};

/**
 * Puppeteer 브라우저 풀
 */
export class PuppeteerPool {
  private browsers: PooledBrowser[] = [];
  private config: PoolConfig;
  private waitQueue: Array<(browser: Browser) => void> = [];
  private isShuttingDown = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 풀 초기화 - 미리 브라우저 생성
   */
  async initialize(): Promise<void> {
    console.log(`🚀 PuppeteerPool 초기화 (${this.config.maxBrowsers}개)`);

    const promises = Array(this.config.maxBrowsers)
      .fill(null)
      .map(() => this.createBrowser());

    await Promise.all(promises);
    console.log(`✅ PuppeteerPool 준비 완료`);
  }

  /**
   * 새 브라우저 인스턴스 생성
   */
  private async createBrowser(): Promise<PooledBrowser> {
    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const pooledBrowser: PooledBrowser = {
      browser,
      inUse: false,
      createdAt: new Date(),
      usageCount: 0,
    };

    this.browsers.push(pooledBrowser);
    return pooledBrowser;
  }

  /**
   * 사용 가능한 브라우저 획득
   */
  async acquire(): Promise<Browser> {
    if (this.isShuttingDown) {
      throw new Error('PuppeteerPool is shutting down');
    }

    // 사용 가능한 브라우저 찾기
    const available = this.browsers.find((b) => !b.inUse);

    if (available) {
      available.inUse = true;
      available.usageCount++;
      return available.browser;
    }

    // 풀이 가득 찼으면 대기
    if (this.browsers.length >= this.config.maxBrowsers) {
      return new Promise((resolve) => {
        this.waitQueue.push(resolve);
      });
    }

    // 새 브라우저 생성
    const newBrowser = await this.createBrowser();
    newBrowser.inUse = true;
    newBrowser.usageCount++;
    return newBrowser.browser;
  }

  /**
   * 브라우저 반환
   */
  async release(browser: Browser): Promise<void> {
    const pooledBrowser = this.browsers.find((b) => b.browser === browser);

    if (!pooledBrowser) {
      console.warn('⚠️ Unknown browser returned to pool');
      await browser.close();
      return;
    }

    // 사용 횟수 초과 시 교체
    if (pooledBrowser.usageCount >= this.config.maxUsagePerBrowser) {
      await this.replaceBrowser(pooledBrowser);
      return;
    }

    pooledBrowser.inUse = false;

    // 대기 중인 요청 처리
    const waiting = this.waitQueue.shift();
    if (waiting) {
      pooledBrowser.inUse = true;
      pooledBrowser.usageCount++;
      waiting(pooledBrowser.browser);
    }
  }

  /**
   * 브라우저 교체 (오래된 것 닫고 새로 생성)
   */
  private async replaceBrowser(pooledBrowser: PooledBrowser): Promise<void> {
    const index = this.browsers.indexOf(pooledBrowser);

    if (index !== -1) {
      this.browsers.splice(index, 1);
      await pooledBrowser.browser.close();
    }

    // 대기 중인 요청이 있으면 새 브라우저 생성
    const waiting = this.waitQueue.shift();
    if (waiting) {
      const newBrowser = await this.createBrowser();
      newBrowser.inUse = true;
      newBrowser.usageCount++;
      waiting(newBrowser.browser);
    } else if (this.browsers.length < this.config.maxBrowsers) {
      // 풀 유지
      await this.createBrowser();
    }
  }

  /**
   * 페이지와 함께 작업 실행 (자동 획득/반환)
   */
  async withPage<T>(
    fn: (page: Page) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<T> {
    const browser = await this.acquire();
    let page: Page | null = null;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 타임아웃 설정
      if (options?.timeout) {
        page.setDefaultTimeout(options.timeout);
      }

      const result = await fn(page);
      return result;

    } finally {
      if (page) {
        await page.close();
      }
      await this.release(browser);
    }
  }

  /**
   * 병렬 실행 (최대 동시 실행 수 제한)
   */
  async parallelExecute<T, R>(
    items: T[],
    fn: (item: T, page: Page) => Promise<R>,
    options?: {
      timeout?: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<R[]> {
    const results: R[] = [];
    let completed = 0;
    const total = items.length;

    // 청크로 분할하여 병렬 처리
    const executeItem = async (item: T): Promise<R> => {
      const result = await this.withPage((page) => fn(item, page), {
        timeout: options?.timeout,
      });

      completed++;
      options?.onProgress?.(completed, total);

      return result;
    };

    // Promise.allSettled로 모든 항목 처리
    const promises = items.map((item) => executeItem(item));
    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // 실패한 항목은 null로 처리 (또는 에러 객체)
        results.push(null as R);
        console.error('Item execution failed:', result.reason);
      }
    }

    return results;
  }

  /**
   * 풀 상태 조회
   */
  getStatus(): {
    total: number;
    inUse: number;
    available: number;
    waiting: number;
  } {
    const inUse = this.browsers.filter((b) => b.inUse).length;
    return {
      total: this.browsers.length,
      inUse,
      available: this.browsers.length - inUse,
      waiting: this.waitQueue.length,
    };
  }

  /**
   * 풀 종료
   */
  async shutdown(): Promise<void> {
    console.log('🛑 PuppeteerPool 종료 중...');
    this.isShuttingDown = true;

    // 대기 중인 요청 취소
    this.waitQueue.forEach((resolve) => {
      // 에러 throw로 대기 중인 요청 거부
    });
    this.waitQueue = [];

    // 모든 브라우저 종료
    const closePromises = this.browsers.map((b) => b.browser.close());
    await Promise.allSettled(closePromises);

    this.browsers = [];
    console.log('✅ PuppeteerPool 종료 완료');
  }
}

// 싱글톤 인스턴스
let pool: PuppeteerPool | null = null;

export async function getPuppeteerPool(config?: Partial<PoolConfig>): Promise<PuppeteerPool> {
  if (!pool) {
    pool = new PuppeteerPool(config);
    await pool.initialize();
  }
  return pool;
}

export async function shutdownPool(): Promise<void> {
  if (pool) {
    await pool.shutdown();
    pool = null;
  }
}
