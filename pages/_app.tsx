/**
 * Minimal _app.tsx for pages-manifest.json generation
 * Required by @opennextjs/cloudflare build process
 *
 * This file is a workaround for the known issue where the adapter
 * expects pages-manifest.json even for App Router-only apps.
 */
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
