# Implementation roadmap
1. Scaffold React TS Vite in a new folder/repo, initialize dependencies and quality tooling. Add docs. Confirm dev/build/lint; no portfolio sections yet.
2. Design tokens, local Geist, global CSS, container, button/link/section heading primitives and typography sample. Review responsive screenshots.
3. Navbar and Hero, build the connected 22-node network with animated packets on every edge, then integrate the orbital cursor separately; validate drag/touch and reduced motion. Phase 03D adds an independent site-wide Canvas particle background after the native SVG network.
4. Professional Status, About, categorized technology tiles for all 22 entries in the shared catalog, using the same local SVGs as the Hero network.
5. Desktop editorial experience/mobile timeline, desktop project index/mobile accordion. Verify shared data and responsive states, actual screenshots.
6. Contact/footer and SEO metadata. Verify email draft, clipboard fallback, actual external links.
7. Test keyboard, mobile, reduced motion, 320/390/768/1024/1440px viewports, console errors, images, layout and motion. Vitest and Playwright. Lighthouse targets 95+ performance (aspirational), LCP <=2.5s, CLS <=0.1, smooth 60fps where device allows. Measure, do not claim untested results. Phase 07A.1 adds the centralized global custom cursor system (`src/features/custom-cursor/`).
8. New GitHub repository (suggested portfolio-v2), separate Vercel project; user approval before push/deploy. Verify production URL and metadata.

Phase 07A.2 implements the Hero name mask (850ms with 135ms stagger), title focus reveal (800ms after 450ms), first-view section heading masks (600ms with 75ms stagger), and identifier decoding (550ms, 40ms refresh). Reduced motion displays final text immediately. Manual desktop and mobile verification is pending.

Phase 07A.3 implements two scoped improvements: the primary CTA rolling fill and Technology Stack grouped focus with technical metadata. Manual desktop, keyboard and touch verification is pending.

Phase 07A.3 also implements the desktop project cover reveal, index title shift and staggered details, the About count-up, and Contact copy and arrow transitions. Manual visual verification and the global motion consistency review are pending.

## Suggested source tree
src/components/ui, common, layout; src/sections/{Hero,ProfessionalStatus,About,TechStack,Experience,Projects,Contact}; src/features/particle-background/{ParticleBackground.tsx,particle-config.ts,particle-engine.ts}; src/features/technology-network/{NetworkSvg.tsx,network-svg-renderer.ts,network-engine.ts,network-interactions.ts,network-config.ts,network.types.ts,OrbitalCursor.tsx}; src/animations/{variants,transitions}.ts; src/data/{profile,technologies,experience,projects}.ts; src/hooks; src/lib; src/types; src/styles/{globals,tokens}.css; src/App.tsx; src/main.tsx; public/{images,fonts,icons/technologies}; tests. Adjust only with justification.

## Phase 1 acceptance
New repository folder distinct from original, package lock, TypeScript strict configuration, Vite dev and production build working, Tailwind v4 Vite integration, lint and format scripts, shadcn initialized with compatible aliases, motion/lucide installed, test scaffolding. Verify installed dependencies rather than guessing. No implementation beyond minimal shell. Report commands and results. Do not push or deploy.
