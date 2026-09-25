#!/usr/bin/env node
// Post-build step: writes one HTML shell per indexable route (dist/<path>/index.html)
// with that route's own <title>/description/canonical/OG/Twitter tags baked in.
//
// Why: this app is a client-only SPA (no SSR) and Vercel rewrites every
// non-asset path to the same index.html. Without this step, a crawler or
// social-share bot that doesn't run JS sees the homepage's canonical/OG tags
// on every route. Vercel's static file resolution serves a matching
// dist/<path>/index.html ahead of the SPA catch-all rewrite, so generating
// these shells fixes that without touching vercel.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEO_ROUTES } from '../src/seoRoutes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const SITE_URL = 'https://ris.hologramconseils.com'

const shell = readFileSync(join(distDir, 'index.html'), 'utf8')

function replaceTag(html, regex, replacement, label, routePath) {
  if (!regex.test(html)) {
    throw new Error(
      `prerender-seo: could not find the ${label} tag while prerendering "${routePath}". ` +
      `The Vite build output format may have changed — update the regex in scripts/prerender-seo.mjs.`
    )
  }
  return html.replace(regex, replacement)
}

function renderRoute(shellHtml, { path, title, description }) {
  const canonical = `${SITE_URL}${path}`
  let html = shellHtml

  html = replaceTag(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, 'title', path)
  html = replaceTag(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${description}" />`, 'meta description', path)
  html = replaceTag(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`, 'canonical link', path)
  html = replaceTag(html, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`, 'og:url', path)
  html = replaceTag(html, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${title}" />`, 'og:title', path)
  html = replaceTag(html, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${description}" />`, 'og:description', path)
  html = replaceTag(html, /<meta property="twitter:url" content="[^"]*"\s*\/?>/, `<meta property="twitter:url" content="${canonical}" />`, 'twitter:url', path)
  html = replaceTag(html, /<meta property="twitter:title" content="[^"]*"\s*\/?>/, `<meta property="twitter:title" content="${title}" />`, 'twitter:title', path)
  html = replaceTag(html, /<meta property="twitter:description" content="[^"]*"\s*\/?>/, `<meta property="twitter:description" content="${description}" />`, 'twitter:description', path)

  return html
}

for (const route of SEO_ROUTES) {
  const html = renderRoute(shell, route)

  if (route.path === '/') {
    // Keep the homepage's own tags in sync with the single source of truth too.
    writeFileSync(join(distDir, 'index.html'), html)
    continue
  }

  const routeDir = join(distDir, route.path.replace(/^\//, ''))
  mkdirSync(routeDir, { recursive: true })
  writeFileSync(join(routeDir, 'index.html'), html)
}

console.log(`prerender-seo: wrote per-route <head> metadata for ${SEO_ROUTES.length} route(s).`)
