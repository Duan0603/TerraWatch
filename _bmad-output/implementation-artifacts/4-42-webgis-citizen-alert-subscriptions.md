# Story 4.42: Citizens subscribe to alert areas on the web (push + SMS)

Status: review

## Story

As a citizen using the WebGIS,
I want to choose the monitoring areas I receive landslide alerts for, and whether they come by app push and/or SMS to my phone,
so that an admin broadcast for my area reaches me even without the mobile app.

## Context

- Backend already exists: `GET/POST/DELETE /api/v1/alerts/subscriptions` (Story 5.7), `GET /api/v1/monitoring-areas`, `GET/PUT /api/v1/auth/me`.
  A broadcast sends SMS to every active subscription with `channel_sms` and a phone number (Story 4.39).
- Until now only the mobile app had this screen, so a citizen who registered on the web could never receive an SMS.
- Same branch also wires the eSMS gateway on the local Docker stack (found while testing 4.39 for Lâm):
  compose passes the SMS env to core-api (sandbox by default), the endpoint is https, and an empty `ESMS_BRANDNAME`
  sends from the eSMS fixed number (SmsType 8) with the real warning text instead of the Baotrixemay carrier template.

## Acceptance Criteria

1. The citizen page shows a card "Nhận cảnh báo theo khu vực" listing every active monitoring area, each with two toggles:
   "Thông báo app" (PUSH) and "SMS".
2. The toggles reflect the citizen's current subscriptions; turning one on subscribes or updates the channels, turning both off removes the subscription.
3. The card shows the phone SMS goes to (masked). SMS cannot be turned on without a phone: the card asks for one (Vietnamese format) and saves it with the subscription.
4. The citizen can change the phone from the card (PUT /auth/me keeps every other profile field).
5. Errors from the API are shown in the card; the toggle returns to its previous state.
6. Tests: unit tests for the helpers, e2e with a mocked backend (subscribe with SMS asks for a phone, unsubscribe, change phone).

## Tasks

- [x] `src/api/alertSubscriptionApi.js`, `src/utils/alertSubscriptions.js` (mask, phone check, channels)
- [x] `src/components/AlertSubscriptionsCard.jsx`, mounted in `CitizenPage.jsx`
- [x] Unit tests (`tests/test-alert-subscriptions.mjs`) + e2e (`e2e/subscriptions.spec.js`)
- [x] eSMS: compose env, https endpoint, fixed-number sending, tests in `EsmsSenderTest`
- [x] Phone SIM as SMS gateway: `SmsGateSender` (SMS Gateway for Android, cloud API, Basic auth), `SMS_PROVIDER=smsgate` + `SMSGATE_USERNAME/PASSWORD`; eSMS fixed number was filtered by Vinaphone as advertising and Baotrixemay forces a car-service template
- [x] Admin broadcast dialog counted Push only and blocked SMS-only areas: `utils/broadcastReach.js` counts devices and SMS subscribers, names both channels (unit test + e2e updated)

## Dev Notes

- No backend change for subscriptions. SMS is charged per message (eSMS ~450 d fixed number); the local stack stays in sandbox unless `ESMS_SANDBOX=0`.
