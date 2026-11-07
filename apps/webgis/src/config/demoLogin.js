// Story 4.24: the quick-login demo buttons (and their shared password) exist only in `npm run dev` or in a
// build made with VITE_DEMO_LOGIN=true (put it in apps/webgis/.env for a rehearsal build). The condition is
// written inline so the bundler folds it to `null` in a normal production build and drops the password:
// checked with `grep` on the built JavaScript.
export const DEMO_ACCOUNTS = (import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true')
  ? {
      password: import.meta.env.VITE_DEMO_PASSWORD || 'Terrawatch@2026',
      citizen: 'citizen.limmong@terrawatch.vn',
      officer: 'officer.yenbai@terrawatch.vn',
      admin: 'admin@terrawatch.vn'
    }
  : null;
