# Release checklist｜Market single-page registration

- [ ] Syntax checks pass.
- [ ] Build injects `doing-market-single-page-registration.js` into `/market/public/`.
- [ ] Desktop real-browser E2E passes.
- [ ] Mobile real-browser E2E passes.
- [ ] Logged-in member fields are auto-filled and visually collapsed.
- [ ] Date is visible immediately.
- [ ] Equipment appears only when session equipment module is enabled.
- [ ] Session editor exposes equipment on/off and item open/off.
- [ ] Agreement content is inline.
- [ ] Agreement checkbox gates submit.
- [ ] Register payload preserves member token/equipment/custom/agreement flags.
- [ ] My Records + cancel regression passes.
- [ ] Existing Market topic filters and 1:1 session cards pass.
- [ ] No Worker/Supabase/2BL changes.
- [ ] Exact head green before merge.
- [ ] Main Pages deployment green after merge.
