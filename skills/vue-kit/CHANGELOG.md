# Changelog

## Unreleased

### Changed

- Adopted **OpenVue 1.x and newer** as the designated alternative UI successor, with **1.0.0** as the verified API snapshot. Core/themes are MIT-licensed and require no application license key, account or hosted service. Vuetify **4.3.x** remains preferred for new general-purpose UI; the authored Vue/Vuetify baseline remains **3.5.44 / 4.3.0**.
- Replaced obsolete component imports, licensing configuration, theme packages and upgrade guidance with OpenVue contracts. The dedicated Vite examples cover labeled Select, local preview Dialog and data-driven Carousel; Carousel uses `value`, an item slot and `v-model:page`, not compound carousel imports. Native root attributes use declared pass-through options under strict template checking.
- Removed hosted authentication SDK installation, credentials, login components, provider middleware and provider endpoint recipes. [Session boundaries](references/auth.md) now teach application-owned readiness, safe redirects, ephemeral token transport and identity retirement. These helpers do not implement server authentication or authorize protected data.
- Revised [Nuxt integrations](references/nuxt-integrations.md) to retain the local Vuetify/Pinia/Colada profile and explicit application-owned identity/cache contracts without a hosted service. Unknown identity and failed teardown remain closed; old callbacks must not populate a new identity's cache.
- Removed streaming provider-key collection/management. [AI streaming](references/ai-streaming.md) retains local client lifetimes and application-owned or self-hosted transport contracts, not hosted-model account setup. [VitePress](references/docs-vitepress.md) uses local search; the VueUse reader accepts an application-owned endpoint.
- Updated master discovery, architecture, routing, tooling, design, sources and public project documentation to match the service-independent scope. The **40-reference** index remains complete and directly discoverable.

### Provenance and verification

- Current schema-2 provenance retains **47 historical roots, 459 source documents and 327 original triage flags** after removing eight superseded input units. Retained source paths, hashes, labels and native hypotheses are unchanged; filtered totals are not a new judgment run. Separate manifest extensions identify OpenVue primary evidence and application-session contracts.
- Historical routing/native judgments remain explicitly historical. The validator fingerprints retained source hashes and native hypotheses, preserves the original 38-reference native map plus two Nuxt extensions, checks complete reference ownership, rejects excluded vendor material outside the single successor attribution, and verifies the packaged-file snapshot.
- Removed superseded audit bodies and runtime reports from the installed skill; original reports remain at repository commit `7bf433b98951918c694358e372d3b02cf6f982e5`. They are not relabeled as fresh acceptance. [Current verification](assets/verification.json) records only exercised cutover checks, exact environments and limits.
- The bundled workbench remains local and in-memory, with pinned Vue/Vuetify/Pinia/Router dependencies and one authoritative Bun lockfile. It requires no account, credential, backend or persistence. Bun remains preferred without overriding an incumbent package-manager choice.
- Extended runtime acceptance beyond typechecking: exact text-chat, JSON/SSE generation and application-owned Axios reader components passed twelve production-browser transport scenarios. Local HTTP/SSE fixtures exercised partial output, completion, errors, cancellation, regeneration, identity remounts and stale-result retirement; they do not certify inference or authentication. Guidance now states actual event ordering, retained-result and settled-cancellation behavior.
- The bearer transport also passed real loopback HTTP dispatch, stale-header replacement, cross-origin rejection before credential retrieval, redirect non-forwarding, generation retirement, pre-aborted request and absent-credential checks. Both public Bun and npm installers independently installed only Vue Kit and matched all 59 files at the recorded cutover commit.
- Certified the official OpenVue Nuxt module in generated strict contexts and a production Node **24.15.0** SSR build: initial theme/component styles, hydration, light/dark body-portaled overlays, keyboard focus and client navigation. Application-owned cookie fixtures additionally exercised concurrent private-cache isolation and identity retirement; they are not a production authentication service.
- Exercised the injected navigation access guard with real delayed allow, deny, HTTP failure, recovery and disposal. Public routes bypassed the application policy endpoint; client navigation remains separate from server authorization.
- Retained the experimental WebGPU recipe and added a separate, source-inspectable browser verification lab. Normal WebGL2 fallback and actual software-WebGPU rendering/unmount were clean; explicitly denied initialization paths remain separately labeled observations, not a universal GPU/library verdict. Optional tailnet HTTPS hosting, raw unsuppressed diagnostics and browser-local PNG/JSON downloads support independent inspection without adding a service dependency to the skill.

### Removed

#### Presentation integration

The previously removed slide-authoring/tooltip integration remains excluded, with its nine historical source records routed only to the [removal decision](references/sources.md#removed-integrations) and [ledger](assets/removals.json). Reintroduction still requires a supported compatibility fix, clean real-browser startup, keyboard/pointer acceptance and production evidence on the Vue baseline. VitePress, Floating UI and Reka remain supported; no shim or diagnostic suppression is introduced.
