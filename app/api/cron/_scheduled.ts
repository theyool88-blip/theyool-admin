/**
 * Cloudflare Workers Scheduled Event Handler
 *
 * This file handles Cloudflare Cron Triggers that replace Vercel Cron.
 * Cron triggers are configured in wrangler.toml.
 */

interface Env {
  SITE_URL: string;
  CRON_SECRET: string;
  // Add other bindings as needed
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Maps cron expressions to their corresponding API routes
 */
const CRON_ROUTES: Record<string, string> = {
  '0 0 * * *': '/api/cron/daily-reminders',           // Daily at midnight
  '*/10 * * * *': '/api/cron/scourt-sync-scheduler',  // Every 10 minutes
  '*/2 * * * *': '/api/cron/scourt-sync-worker',      // Every 2 minutes
  '* * * * *': '/api/cron/batch-import-worker',       // Every minute
};

/**
 * Executes a cron job by fetching the corresponding API route
 */
async function executeCronJob(
  route: string,
  env: Env,
  cron: string
): Promise<void> {
  const url = `${env.SITE_URL}${route}`;

  console.log(`[Cron: ${cron}] Starting job: ${route}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'X-Cron-Trigger': 'cloudflare',
        'User-Agent': 'Cloudflare-Workers-Cron',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Cron job failed with status ${response.status}: ${text}`
      );
    }

    const result = await response.json();
    console.log(`[Cron: ${cron}] Job completed successfully:`, result);
  } catch (error) {
    console.error(`[Cron: ${cron}] Job failed:`, error);
    throw error;
  }
}

/**
 * Main scheduled event handler
 */
const scheduledHandler = {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const { cron, scheduledTime } = event;

    console.log(
      `[Cron] Triggered at ${new Date(scheduledTime).toISOString()} with expression: ${cron}`
    );

    // Find the matching route for this cron expression
    const route = CRON_ROUTES[cron];

    if (!route) {
      console.error(
        `[Cron] No route configured for cron expression: ${cron}`
      );
      return;
    }

    // Execute the cron job asynchronously
    ctx.waitUntil(
      executeCronJob(route, env, cron).catch((error) => {
        console.error(`[Cron] Unhandled error in job execution:`, error);
      })
    );
  },
};

export default scheduledHandler;
