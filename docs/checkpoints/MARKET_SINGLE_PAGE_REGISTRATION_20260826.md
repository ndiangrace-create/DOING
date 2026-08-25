# DOING Market｜Single-page registration checkpoint｜2026-08-26

## Scope
- Logged-in member opens a session and immediately sees the registration form.
- One modal/page only: no 4-step wizard, no Next/Back flow.
- Member identity is auto-filled from DOING member session and collapsed to a compact signed-in summary.
- Date selection is immediately visible.
- Equipment is immediately visible only when the session-level equipment module is enabled; backend session editor already supports `fullEquipment` on/off and per-equipment `open` on/off.
- Enabled add-ons/custom fields/invoice remain on the same page.
- Agreement content is loaded inline in the same page.
- Required agreement must be checked before submit; submit remains disabled until the agreement is loaded and checked.
- Existing Core register/cancel, SSOT, member token, payment, review, seat and refund contracts remain unchanged.

## Verification contract
Desktop 1440 and mobile 390 real-browser E2E must verify:
1. session modal opens without navigation;
2. wizard/Next/Back are not visible;
3. signed-in member summary is shown and member inputs remain populated in DOM;
4. date and enabled equipment are visible at the same time;
5. contract is inline and submit is disabled before agreement checkbox;
6. checking agreement enables submit;
7. register payload includes member token, equipment, custom field, agreementViewed and agreementAccepted;
8. My Records appears and cancellation succeeds.

## Safety
- No Worker change.
- No Supabase schema/data change.
- No 2BL change.
- Deployment only after exact PR head is green.