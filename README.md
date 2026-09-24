# Zadeed's Physics Lab

Interactive 3D physics laboratory for Bangladesh HSC Physics — 1st Paper (10 chapters) and 2nd Paper (11 chapters). Every syllabus topic has a live simulation with adjustable parameters, real-time graphs, equations with live substitution, a Learn panel and an experiment mode that records measurements to CSV.

**Live site:** https://hsc-physics-lab.vercel.app/

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck
npm test           # physics unit tests + a run of every simulation module
npm run build
```

Built with React, TypeScript, Vite, Tailwind CSS and Three.js. Each simulation lives in `src/sims/<id>/index.ts` and is registered automatically; pure physics formulas are in `src/physics/`.

Pushing to `main` deploys to Vercel (`vercel.json`), which runs the tests before going live. GitHub Actions (`.github/workflows/ci.yml`) type-checks, tests and builds every push and pull request.
