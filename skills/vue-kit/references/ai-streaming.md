# AI streaming in Vue

Read when adding TanStack AI chat, tools, or generation UI to an existing local/self-hosted backend. This reference owns browser streaming transport and lifecycle, not model hosting, hosted-provider setup, subscription accounts, or API-key collection. The host must already implement the chosen stream protocol; installing a Vue adapter does not supply inference. Read [auth.md](auth.md) for identity/authorization, [accessibility.md](accessibility.md) for interaction, and [architecture-data.md](architecture-data.md) for durable data ownership.

## Version and entry-point boundary

Current source-backed pins for an optional browser consumer: Vue **3.5.46**, **`@tanstack/ai-vue@1.1.1`**, **`@tanstack/ai-client@1.2.1`**, **`@tanstack/ai@1.8.0`**. Vue peers on Vue `>=3.5.0` and AI `^1.7.0`; its client dependency is `^1.2.1`, and the client depends on AI `^1.7.0`. Core's `@opentelemetry/api >=1.9.0` peer is optional; the browser examples do not opt into telemetry. These are stable 1.x releases, not a rerun of the earlier Vue/browser/compiler profiles. [Vue manifest](https://registry.npmjs.org/@tanstack/ai-vue/1.1.1), [client manifest](https://registry.npmjs.org/@tanstack/ai-client/1.2.1), [core manifest](https://registry.npmjs.org/@tanstack/ai/1.8.0).

```sh
bun add --exact @tanstack/ai-vue@1.1.1 @tanstack/ai-client@1.2.1 @tanstack/ai@1.8.0
```

Upgrade any TanStack backend alongside its client, or implement the corresponding 1.x transport in the host; do not assume 0.x event or saved-data compatibility. [Core 1.0.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai@1.0.0), [client 1.0.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-client@1.0.0), and the [1.0 migration guide](https://tanstack.com/ai/latest/docs/migration/v1) cover removed aliases, wire events, and storage readers. Do not borrow React hooks or another SDK's message names.

The complete chat pane uses `Array.prototype.findLastIndex`: include `ES2023` or newer in TypeScript's `lib` and target a runtime that implements it, or supply the application's supported polyfill. Compilation libraries do not polyfill the browser. Historical root-hook checks used Vue **3.5.44**, Vue adapter **0.27.0**, client **0.40.0**, AI **0.70.0**, TypeScript **5.9.3**, and vue-tsc **3.3.13**, with `strict`/`strictTemplates` and the established `skipLibCheck` boundary. A stronger `exactOptionalPropertyTypes`/full dependency-declaration check exposed an upstream adapter declaration conflict; TypeScript 7 was incompatible with that vue-tsc release. Those observations are not claims about 1.x or permission to weaken an incumbent application's checks.

| Need | Source-checked Vue API / decision |
| --- | --- |
| Chat | `useChat` from `@tanstack/ai-vue`; return values are readonly refs and action methods. |
| Transport | Root re-exports `fetchServerSentEvents`, `fetchHttpStream`, `xhrServerSentEvents`, `xhrHttpStream`, `stream`, `rpcStream`, `webSocket`, `fetchJson`, and `ConnectionAdapter`. Start with native-fetch SSE for an existing TanStack SSE endpoint; NDJSON, durable JSON polling and WebSocket require matching server protocols. Arbitrary token text is not a TanStack AI event stream. |
| Reusable chat configuration | Root `createChatHook(options)` returns `{ useChat }`. Pass required `threadId` on each bound call, never in factory options. Other supported per-instance overrides: `live`, `forwardedProps`, `initialMessages`; not transport, schema, or tool definitions. |
| Typed client tools | Root re-exports `clientTools`, `createChatClientOptions`, `InferChatMessages`. Define shared schemas with `toolDefinition` from `@tanstack/ai`; implement browser-safe behavior with `.client()`. |
| Headless chat UI | `@tanstack/ai-vue/ui` exports its own `createChatHook`, `createChatUI`, and renderless `UIChat`, `UIProvider`, `UIMessages`, `UIMessage`, `UIPart`, `UIInterrupts`, `UIInterrupt`, `UIQueue`. Do not confuse its factory with the root factory. |

The `/ui` entry still ships `.ts`/`.vue` source. Its factory takes `{ options, components, partsComponents, toolsComponents, interruptsComponents }` and returns `{ useAppChat, ui, useChatContext }`; chrome needs layout/message components. `TextPart` and `ThinkingPart` remain; the 0.x `Chat`, `ChatInput`, `ChatMessage`, `ChatMessages`, `ToolApproval`, and top-level `useChatContext` do not. A markdown/highlighter component is not permission to insert untrusted HTML. [Current Vue UI exports](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/ui.ts), [UI guide](https://tanstack.com/ai/latest/docs/ui/vue).

**Historical full-template negative, not a current pass.** The full strict `/ui` run on **0.27.0** with `vueCompilerOptions.dataAttributes: ['data-*']` retained two diagnostics: published `chat-message.vue:58` passed a `string | number` loop index where a helper expected `number`, and the consumer passed a typed boolean-response interrupt to `UIInterrupt`'s broad prop. The old message renderer is absent from the 1.1.1 entry; that does not establish full strict-template compatibility of its replacements. The generic interrupt boundary still exists in current source (see below). The data-attribute option permits legitimate native `data-*` attributes; `skipLibCheck: true` does **not** skip imported `.vue` source. [Old renderer](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/chat-message.vue), [current renderer prop contracts](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/create-ui.ts).

The historical proof IDs `current-audit/contracts/strict-ui` and `current-audit/contracts/strict-ui-script-api` are distinct. The first included the full consumer and imported templates; the second explicitly used `skipTemplateCodegen: true`. The initial script/API-only run passed; a later generic-boundary correction exposed a schema-specific approval tuple mismatch in **both** profiles. Keeping approvals in the explicitly typed widget was not followed by an observed full-template pass. SCRIPT/API-only does not check consumer/vendor templates, bindings, slots or runtime behavior. Neither the old narrower pass nor this source review certifies `/ui`, dependency declarations, or SSR. Do not patch, cast, or shim vendor code to manufacture compatibility.

## Ownership before implementation

1. Identify the existing local/self-hosted backend, authentication mechanism, stream format, and whether a conversation is ephemeral or persisted. Do not create an imaginary `/api/chat` and describe it as functioning.
2. Give each mounted chat one identity: authenticated principal + tenant + conversation + transport/configuration revision. Remount on identity changes; do not mutate a connection's identity underneath an active client.
3. Pass a stable `threadId` and exactly one `connection` **or** `fetcher` in `UseChatOptions`. `ChatFetcher` receives `(input, { signal, headers? })`; `input` includes the full `messages`, `threadId`, `runId`, and optional `data`, `parentRunId`, and `resume`. Return a `Response` with SSE or an `AsyncIterable<StreamChunk>`, synchronously or asynchronously. Forward the signal, applicable request headers, and run identity to the real service. Prefer the built-in adapter when the backend implements the corresponding protocol.
4. Keep server credentials and privileged inference configuration on the server. Never place secrets in `VITE_*`, client modules, rendered props, URLs, or browser storage. This guide does not collect or relay hosted-service keys.
5. Treat messages, `forwardedProps`, tool advertisements/results, resume payloads, and IDs from a browser as untrusted. A `threadId` is a lookup key, not proof of ownership.

**Application-owned server responsibilities:** authenticate each send, hydration, join, live subscription, resume, cancellation, and history request; authorize principal/tenant/thread/run; enforce CSRF protection where applicable, model/tool allowlists, input/token/upload limits, concurrent-run and resource/rate limits; validate tool arguments and outputs; authorize every side effect at execution time; propagate cancellation where supported; bound stream lifetime; redact backend errors and credentials. Build server prompts/policy from trusted configuration, not client-supplied system messages. Keep durable audit/persistence and idempotency for business operations server-side. A browser approval is user intent, not server authorization. These are architectural requirements, not guarantees of `useChat`.

## Chat state and commands

[Exact Vue return/options declarations](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/types.d.ts), [client states, transport input and persistence](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/types.d.ts).

| Surface | Meaning and required handling |
| --- | --- |
| `messages` | Readonly transcript array; each `UIMessage` has `id`, `role`, `parts`. Text is `{ type: 'text', content }`, not a message-wide `content` string. Render stable message IDs and explicitly handle supported parts. Do not expose internal `thinking` content by default. |
| `status` | `'ready' \| 'submitted' \| 'streaming' \| 'error'`; ready does not certify a saved conversation or completed server work after cancellation. |
| `isLoading` | Request-local generation activity. Guard submissions and allow cancellation. `sessionGenerating` is shared-session activity; `connectionStatus` (`disconnected/connecting/connected/error`) and `isSubscribed` describe subscription lifecycle, not generation success. |
| `isHydrating` | Transcript restoration still in progress. Show loading rather than an empty-state claim; prevent sending against an unfinished restoration. |
| `sendMessage(textOrMultimodal, options?)` | Async send. `options.whenBusy` is `queue`, `drop`, or `interrupt`; queue only when the UI exposes queued items and `cancelQueued(id)`. A resolved dropped send does not mean delivery. The example disables concurrent sends instead. |
| `reload()` | Regenerates from the last user message, removes subsequent messages, and discards pending queued sends. This is a new model invocation, not a harmless read or guaranteed replay. |
| `stop()` | Aborts the local request, drops queued sends/resume state, and resets interrupts. With a configured `cancelRun` it also attempts a best-effort server cancel for the active local run. Capture `runId` before stopping when the app must correlate or confirm server cancellation independently. |
| `clear()` / `setMessages()` | Client transcript changes, not a server deletion API or a business-data commit. `clear()` also cancels local work and removes client-adapter persistence when configured. Server data needs an explicit authorized deletion workflow. |
| `onChunk` / `onFinish` / `onError` | Lifecycle callbacks; avoid token-by-token analytics, secret/transcript logging, and business mutations on finish. Handle action rejection and the error ref without rendering raw backend errors. |

Use `.value` **in script**. Destructured top-level refs auto-unwrap **in Vue templates**: `v-for="message in messages"`, `:disabled="isLoading"`. If keeping the plain return object as `chat`, its nested refs require `chat.messages.value`. State is not writable: call actions instead of assigning/pushing into returned refs. The adapter derives state from readonly computed snapshots; rely on the public ref contract, not a mutable shallow-ref implementation detail.

`append(message)` normally adds a model/UI message **and requests a response**; system messages are ignored, and frontend-only activity messages are appended without a run. Use `setMessages` for a client-only transcript replacement, not `append` as a passive history importer. Multimodal sends use `sendMessage({ content: [...] })`; enforce upload MIME/size/count limits on the server, not only in a file picker. Per-send `{ body }` merges forwarded JSON for that request; prefer the hook's `forwardedProps` for ongoing application parameters.

Callbacks also include `onResponse`, `onCustomEvent`, and `onInterruptStateChange`. The adapter reads the latest callback from the original options object at invocation time; a local variable reassignment does not mutate that object. Keep callbacks short and nonthrowing: a throwing callback can fail processing. `streamProcessor` configures client processing/batching, not server rate limiting or durable delivery. `devtools` accepts display options; Vue/framework/hook metadata is injected. Enable transcript/tool inspection only under the application's data policy.

The hook's `queue` option accepts a `WhenBusy` shorthand, `QueueConfig`, or `QueueStrategy`. Config uses `whenBusy` (default `queue`), `drain: 'fifo' | 'batch'` (default FIFO), optional `maxSize` (unbounded if omitted), and `onOverflow: 'reject' | 'drop-oldest'`. Overflow `reject` silently drops the new send; it does not throw. Choose an explicit bound and show pending/evicted/not-delivered state. Batch drain merges queued items into one send after a successful run; do not imply each item remains a separate invocation. A strategy receives `{ pending, busyReason, queued }` and returns `{ action }`; strategy drain stays FIFO and per-send `whenBusy` wins. Concurrent streams are not supported.

Since [client 1.1.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-client@1.1.0), a paused interrupt holds queued messages until a successful resolving run. The same release propagates both SDK and caller signals to the fetch/XHR connections and ends `stream()`/`rpcStream()` consumption on abort even when the source ignores it. Ending consumption is not proof that upstream production stopped. Keep owner identity checks for delayed local callbacks and pass cancellation all the way to the producer.

## Complete browser pane with an explicit transport contract

The following two SFCs form a Vue-side integration example, **not a standalone server demo**. The host supplies an already-authorized `ConnectionAdapter` over its existing local/self-hosted service. Use `fetchServerSentEvents(actualAuthorizedUrl, () => actualFetchOptions)` with application-owned `credentials`/`headers`/`fetchClient` if the server speaks SSE; omit `cancelUrl` for this local-only Stop button. No backend, fake stream, or endpoint implementation is supplied here. Bind URL/options to this identity; never retarget an adapter across accounts.

For the text-only SSE contract, return `Content-Type: text/event-stream` and send JSON `data:` frames separated by blank lines: `RUN_STARTED` (`threadId`, `runId`), `TEXT_MESSAGE_START` (`messageId`, `role: 'assistant'`), incremental `TEXT_MESSAGE_CONTENT` (`messageId`, `delta`), `TEXT_MESSAGE_END` (`messageId`), then `RUN_FINISHED` (`threadId`, `runId`, `outcome: { type: 'success' }`). Failure terminates with `RUN_ERROR` and a top-level `message` (and optional `code`), not a nested error object. Echo the submitted thread/run IDs, reuse the message ID for its deltas, and close after the terminal event. No raw tokens or `[DONE]`; HTTP closure alone is not success. [1.x wire migration](https://tanstack.com/ai/latest/docs/migration/v1#custom-servers-that-stream-to-a-tanstack-ai-client), [current event declarations](https://unpkg.com/@tanstack/ai@1.8.0/dist/esm/types.d.ts).

The standard HTTP adapter POSTs the AG-UI `RunAgentInput`, not a guessed `{ prompt }` shape. Read `threadId`, `runId`, `messages`, optional `resume`, and application fields under `forwardedProps` with `chatParamsFromRequest()`/`chatParamsFromRequestBody()` on the server; the old top-level `data` alias is gone. Custom `connect(messages, data, signal, runContext)` and `send(...)` take the required fourth run context; `stream()`/`rpcStream()` factories receive the full `RunAgentInput` in that position instead. Forward the signal and needed context headers, and authorize every run/cursor server-side. [Exact adapter declarations](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/connection-adapters.d.ts).

For an incumbent **AI SDK v7** route, [Vue 1.1.1](https://github.com/TanStack/ai/releases/tag/%40tanstack%2Fai-vue%401.1.1) and [client 1.2.1](https://github.com/TanStack/ai/releases/tag/%40tanstack%2Fai-client%401.2.1) pass chat configuration to the separate [`@tanstack/ai-vercel-compat@0.1.0` bridge](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-vercel-compat@0.1.0). `fromChatTransport` reads `threadId`, tools and schema from `useChat`; custom adapters can read `runContext.config`, and `joinRun` can receive `ChatRunConfig` as a third argument. The [bridge's published peers](https://registry.npmjs.org/@tanstack/ai-vercel-compat/0.1.0) are `ai ^7.0.0`, `@tanstack/ai ^1.7.0`, and `@tanstack/ai-client ^1.2.1`. Its format, `Output.object` mapping, and reconnect behavior are a migration path, not a dependency of this pane or permission to configure a hosted provider.

`ChatHost.vue` defines the application-owned integration interface through props. Replace the whole context atomically on account, tenant, thread, or transport configuration change; `identityKey` must be unique to that complete identity, including a new login session. Set it to `null` immediately on logout. Do not wrap this pane in `KeepAlive` or share its instance across SSR requests.

```vue
<script setup lang="ts">
import type { ConnectionAdapter } from '@tanstack/ai-vue'
import ChatPane from './ChatPane.vue'

defineProps<{
  context: {
    identityKey: string
    threadId: string
    connection: ConnectionAdapter
  } | null
}>()
</script>

<template>
  <ChatPane
    v-if="context"
    :key="context.identityKey"
    :thread-id="context.threadId"
    :connection="context.connection"
  />
  <p v-else>Sign in to start a conversation.</p>
</template>
```

`ChatPane.vue` is **text-only, ephemeral, and mounted by a browser app**: no tools, approvals, automatic business actions, or client persistence. The host supplies an adapter without remote cancellation for this local-only UI, and server policy must disable tools for this surface. A received unsupported part is visibly unsupported rather than silently treated as text or executed.

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useChat, type ConnectionAdapter } from '@tanstack/ai-vue'

const props = defineProps<{
  threadId: string
  connection: ConnectionAdapter
}>()
const draft = shallowRef('')
const acting = shallowRef(false)
const notice = shallowRef('Ready.')
const actionFailed = shallowRef(false)
const incomplete = shallowRef<ReadonlySet<string>>(new Set())
let mounted = true
let actionGeneration = 0
let completed = false

const {
  messages, status, error, isLoading, isHydrating, resuming, interrupts, runId,
  sendMessage, reload, stop,
} = useChat({
  connection: props.connection,
  threadId: props.threadId,
  persistence: false,
  onChunk(chunk) {
    if (acting.value && chunk.type === 'RUN_FINISHED' && chunk.runId === runId.value
      && (!chunk.outcome || chunk.outcome.type === 'success')) {
      completed = true
    }
  },
})
const busy = computed(() => acting.value || isLoading.value || resuming.value)
const paused = computed(() => interrupts.value.length > 0)
const blocked = computed(() => busy.value || isHydrating.value || paused.value)
const failed = computed(() => actionFailed.value || Boolean(error.value))
const canRegenerate = computed(() =>
  !blocked.value && messages.value.some(message => message.role === 'user'),
)

function markIncomplete() {
  const list = messages.value
  const lastUser = list.findLastIndex(message => message.role === 'user')
  const lastAssistant = list.findLastIndex(message => message.role === 'assistant')
  const message = list[lastAssistant]
  if (lastAssistant > lastUser && message) {
    incomplete.value = new Set([...incomplete.value, message.id])
  }
}

async function run(kind: 'send' | 'regenerate') {
  if (!mounted || blocked.value || (kind === 'regenerate' && !canRegenerate.value)) return
  const text = draft.value.trim()
  if (kind === 'send' && !text) return
  const generation = ++actionGeneration
  completed = false
  acting.value = true
  actionFailed.value = false
  notice.value = 'Assistant response started.'
  if (kind === 'send') draft.value = ''
  try {
    if (kind === 'send') await sendMessage(text)
    else await reload()
    if (!mounted || generation !== actionGeneration) return
    if (interrupts.value.length && !error.value) {
      notice.value = 'Response paused. This text-only pane cannot resolve tools.'
    } else if (error.value || !completed) {
      actionFailed.value = true
      markIncomplete()
      notice.value = 'Response did not complete. Partial output may be incomplete.'
    } else {
      notice.value = 'Response finished. Review the assistant text.'
    }
  } catch {
    if (!mounted || generation !== actionGeneration) return
    actionFailed.value = true
    markIncomplete()
    notice.value = 'Response failed. Partial output may be incomplete.'
  } finally {
    if (mounted && generation === actionGeneration) acting.value = false
  }
}

function cancel() {
  ++actionGeneration
  markIncomplete()
  stop()
  acting.value = false
  notice.value = 'Local response stopped. Existing output may be incomplete.'
}

onBeforeUnmount(() => {
  mounted = false
  ++actionGeneration
  draft.value = ''
})
// useChat's scope cleanup detaches and disposes the client. Do not invoke
// the user Stop action here: an adapter may opt into server cancellation.
</script>

<template>
  <section aria-label="AI conversation">
    <!-- Announce lifecycle changes, not every token or the entire transcript. -->
    <p role="status" aria-live="polite" aria-atomic="true">{{ notice }}</p>
    <p v-if="isHydrating">Restoring conversation…</p>
    <p v-if="failed" role="alert">
      The response could not finish. Check your connection or sign-in, then
      regenerate the last response. Regeneration can incur another model call.
    </p>
    <p v-if="paused">A tool or approval requires a different authorized interface.</p>
    <ol aria-label="Messages" aria-live="off" :aria-busy="busy">
      <li v-for="message in messages" :key="message.id">
        <strong>{{ message.role }}:</strong>
        <template v-for="(part, index) in message.parts" :key="index">
          <p v-if="part.type === 'text'" class="message-text">{{ part.content }}</p>
          <p v-else-if="part.type !== 'thinking'">Unsupported message part.</p>
        </template>
        <p v-if="incomplete.has(message.id)">Incomplete response.</p>
      </li>
    </ol>
    <form @submit.prevent="run('send')">
      <label for="chat-prompt">Message</label>
      <textarea
        id="chat-prompt"
        v-model="draft"
        :readonly="blocked"
        aria-describedby="chat-help"
      />
      <p id="chat-help">Enter inserts a newline. Use Send to submit.</p>
      <button type="submit" :disabled="blocked || !draft.trim()">Send</button>
      <button type="button" :disabled="!busy && !paused" @click="cancel">
        Stop local response
      </button>
      <button type="button" :disabled="!canRegenerate" @click="run('regenerate')">
        Regenerate last response
      </button>
    </form>
    <p>Stream state: {{ status }}. This conversation is not saved by this pane.</p>
  </section>
</template>

<style scoped>
.message-text { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
```

The action's busy flag prevents duplicate sends before the SDK snapshot updates. A resolved action is not the success signal: the example requires a success terminal event for the active run, checks the error/interrupt state, and invalidates old local continuations before Stop or unmount.

Keep keyboard focus predictable: do not focus each streamed message or scroll users away from text they are reviewing. If an active cancel control becomes disabled, restore focus to the composer after the action if needed in the application's focus model. Add a user-controlled “Jump to latest” for long transcripts; do not make the transcript an assertive live region. The example uses a real form, persistent labels, polite start/end/cancel announcements, a separate generic error alert, preserved submitted text in the transcript, and explicit retry through regeneration rather than automatic duplicate sends. Its fixed DOM IDs assume one pane per page; assign instance-specific IDs for multiple panes.

## Headless UI registry, composition, and incumbent migration

Consider the `/ui` factory when message/tool/interrupt widgets are shared, not merely to replace a small local pane. These are source contracts, not a replacement for the full strict-template/runtime check. [Pinned registry/prop types](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/create-ui.ts), [bound factory](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/create-chat-hook.ts).

1. Bind real chat options and the widget registry with `/ui` `createChatHook`. Call its `useAppChat({ threadId, ... })` once in identity-owned setup; `threadId` is required at this call, not in the factory. Render `UIChat` with the **same** `ui` and `chat`. Factory configuration may live at module scope only when it does not capture per-request credentials or user state.
2. Provide `components.layout` and `components.message`; `input` and `queue` are optional. Layout renders its named `messages`, `interrupts`, `queue`, and `input` slots. The message widget renders its **`parts`** slot; dropping it silently drops automatic part rendering.
3. Map `partsComponents` by the UI-selected part key, not arbitrary message properties; provide a visible unsupported fallback. Named tools require a `toolsComponents` entry per tool. Named generic interrupts require `interruptsComponents.generic` entries per interrupt ID; `generic.fallback` covers unknowns, and `interruptsComponents.tools` can override tool-approval widgets by tool name. Missing registry entries can render nothing and produce development warnings: this is not an intentional denial UI.
4. Keep composer state and accessible form/stop/error behavior in the input widget. It calls the factory's `useChatContext()` in a **descendant** of the provider to use the existing chat; calling `useAppChat()` there would create a second chat. Apply the pane's hydration, busy, interrupt, and identity guards. Enabling queued sends also requires a queue widget that exposes cancellation.

| Renderless surface | Inputs / extension contract |
| --- | --- |
| `UIProvider` | `ui`, `chat`, optional runtime `components`; provides context without rendering the standard layout. Use for a custom layout around the existing instance. |
| `UIChat` | Same inputs; provides context and wires the layout's four named slots. |
| `UIMessages` | `ui`; defaults to one `UIMessage` per message. A custom default slot receives `{ messages }` and takes over list rendering. |
| `UIMessage` | `ui`, `message`, optional `interrupts`; defaults to the registered message widget with automatic parts. A custom default slot receives selected `{ parts }` and takes over that rendering. |
| `UIPart` | `ui`, `part`; dispatches a raw message part through selection/registry rules. |
| `UIInterrupts` / `UIInterrupt` | List takes `ui` (optional custom slot `{ interrupts }`); single takes `ui` and `interrupt`. Preserve resolve/deny/error states rather than hiding the list. |
| `UIQueue` | `ui`; renders the configured queue widget once per pending item. Its `item` includes a bound `cancelQueued()`; absence of a queue widget hides the queue. |

Widgets receive typed **props**, not legacy content-shaped context: `MessageProps<TOptions>` has `message`; `PartProps<TOptions, TKey>` has `part`; `ToolProps<TOptions, TName>` has `part`, optional `result`, optional approval `interrupt`; `InterruptProps<TOptions, TName>` has `interrupt`; `QueueProps<TOptions>` has `item`. Derive `TOptions` from the shared options object so tool names and schemas remain linked. Read the part/tool/interrupt props directly; `useChatContext()` is for chat state/actions. `createChatUI(options, config)` creates just the descriptor for an independently constructed chat. `createChatHookContexts()` creates fresh injection keys; pass its keys through factory `context` when cross-file widgets cannot import the factory result or nested chat trees need isolation. A missing/mismatched provider throws; do not catch it by inventing a fallback chat.

**Registered interrupt boundary in current source.** `UIInterrupt` is concrete, not options-generic: its prop is `ChatUIInterrupt`. `UIInterrupts` selects broad interrupts, not a schema-specialized slot list. The client defines the generic member's resolver as `(payload: unknown) => void`, whereas `InterruptProps<TOptions, 'confirmReview'>` keeps that registered response schema (boolean in the historical consumer). A boolean-only function cannot accept arbitrary unknown data. Do not cast it to the broad prop. [Current client interrupt types](https://unpkg.com/@tanstack/ai-client@1.2.1/src/types.ts), [UI interrupt selection types](https://unpkg.com/@tanstack/ai-client@1.2.1/src/ui/types.ts).

When explicitly passing that typed interrupt to `UIInterrupt`, introduce a real validating adapter at the renderer boundary. For this consumer's **single registered generic definition**, copy the interrupt descriptor and replace only its resolver with `(response: unknown) => void`: run the same `decisionSchema['~standard'].validate(response)` used by `defineInterrupt`, throw on validation issues, and forward only `result.value` to the original boolean-coupled `interrupt.resolveInterrupt`. Pass through nonregistered generic and unbound interrupts unchanged. **Do not pass tool approvals through this adapter:** their schema-dependent approve/reject option tuples can also conflict with the broad `ChatUIInterrupt` approval member. The consumer narrows `kind === 'tool-approval'` and renders its existing `ApprovalWidget` directly with `InterruptProps<Options, 'reviewText'>`; only the other variants reach `UIInterrupt`, and the adapter's input type explicitly excludes tool approvals. This preserves the real approval/denial actions and lifecycle guards without claiming generalized renderer compatibility. The generic adapter preserves IDs, bindings, lifecycle fields and actions; widget props and host retain their original schema types, and invalid unknown input never becomes an approval or a default decision. Derive the broad return type from `InstanceType<typeof UIInterrupt>['$props']['interrupt']` rather than inventing a substitute interface. Applications with multiple registered definitions must select the matching response schema and typed resolver for each definition; this boolean adapter is not a universal interrupt implementation. It supplies a real runtime boundary, not proof that the release supports every renderer/options pairing.

Migrating from 0.x: move old connection/options to the factory, replace old `CHAT_KEY` and standalone `useChatContext` with the factory's context, port content to message `parts` slots and part widgets, and port approval to typed interrupt/tool props. Remove the old prebuilt imports and the obsolete `@tanstack/ai-vue-ui` package; they are not 1.x fallbacks. Preserve keyboard, cancellation and denial behavior. Keep the application-owned root pane as the bounded choice until your own full-template and runtime checks pass.

`TextPartProps` / `ThinkingPartProps` describe the remaining prebuilt part renderers, **not** `PartProps`: text takes `content`, optional `role`, classes, markdown `extensions`, and `highlighter`; thinking takes `content` and optional `isComplete`. Highlighter output is trusted HTML, so use an escaping highlighter and a constrained markdown/resource policy. A custom part widget can render `part.content` as escaped interpolation. Do not expose hidden reasoning merely because a thinking renderer exists. [Current part props](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/types.ts).

## Tools, approvals, and structured output

A tool-enabled surface must replace the text-only policy above with an intentional tool registry and UI. [Vue tool API](https://tanstack.com/ai/latest/docs/api/ai-vue), [pinned tool declarations](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/types.d.ts).

- Define tool name/input/output schemas once; share browser-safe definitions, not privileged server implementations. `clientTools(toolDefinitionResult.client(implementation), ...)` preserves tool-name typing; `createChatClientOptions` plus `InferChatMessages` can preserve that type across components. Registered client tools execute automatically; there is **no `onToolCall` option** to copy from another SDK. Keep privileged effects on the server.
- Tool-call states are `awaiting-input`, `input-streaming`, `input-complete`, `approval-requested`, `approval-responded`, `complete`, `error`. Never execute streamed/partial JSON arguments. Render each call by call ID, proposed action, validated arguments, approval state, and result/error. Tool-result states are `streaming`, `complete`, `error`; a denial/cancellation outcome can accompany error state.
- Use typed `interrupts` and their bound `resolveInterrupt` methods. Inspect `kind`, `canResolve`, `status`, `errors`, and `resuming`; the `tool-approval` interrupt accepts an approval boolean and schema-dependent options, while generic interrupts accept their registered response payload. Unbound interrupts cannot be resolved here. `addToolApprovalResponse`, `pendingInterrupts`, and `resumeInterrupts` are removed in 1.x; unbound 0.x descriptors are not resumable. Keep approve and deny explicit and guarded; use `interruptErrors` and `retryInterrupts()` for recovery rather than forging an unsafe resume.
- `resolveInterrupts(false)` supplies bulk approval denial; prefer per-item decisions for mixed or sensitive batches. Its resolver callback must invoke each selected interrupt's typed `resolveInterrupt(...)` and return `undefined`; it is not a generic `return true` mapper. Per-item `cancel()` / `clearResolution()` and batch `cancelInterrupts()` manage staged resolution, while `retryInterrupts()` retries failed submission. Use item status/errors plus batch errors and `resuming` to drive the UI; `canResolve` describes binding/schema capability and does not itself reflect expiry or in-flight submission. `initialResumeSnapshot` can seed descriptors for restored continuation, but must belong to the same authorized identity/thread; never trust browser resume state as server permission.
- Manual execution surfaces use `addToolResult({ toolCallId, tool, output, state?: 'output-available' | 'output-error', errorText? })`. Those submission-state names differ from rendered tool-call states. Do not add a second result for an automatically executed tool or rerun a side effect after a network error without server-side idempotency.
- Bind approval and tool execution to the current principal, tenant, thread, run, and proposal. On a TanStack backend, `onGuardToolCall` inspects the final validated arguments before dispatch to server or client; keep real authorization there or in the equivalent application service. Stop/unmount cannot roll back completed effects. Since client 1.1.0, `.client()` implementations can honor their execute context's `abortSignal` on explicit stop, but still need identity guards before publishing. [Server guard type](https://unpkg.com/@tanstack/ai@1.8.0/dist/esm/activities/chat/middleware/types.d.ts), [client changes](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-client@1.1.0).
- Client and server tools must share input **and output** schemas to resume automatically. Client 1.1.0 can produce a bound approval for unanswered `needsApproval` client calls from custom AG-UI backends; that browser decision is not a server-side access check. [1.0 migration](https://tanstack.com/ai/latest/docs/migration/v1#client-tools).
- [Core 1.7.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai@1.7.0) / [client 1.2.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-client@1.2.0) add server-owned `resultMetadataSchema` and `part.resultMetadata` for app/UI metadata not passed to the model. Do not trust replayed browser metadata or use this feature to send secrets to the client. Client and WebMCP tools cannot set this server metadata.
- A terminal event in a tool-enabled flow is not necessarily normal model completion: [core 1.3.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai@1.3.0) adds `metadata.tanstack.loopStopped` when a loop cap or middleware stops with tool work pending. Distinguish normal, policy-limited, canceled, and interrupted outcomes rather than reusing the text-only pane's terminal rule for agents.
- `outputSchema` supplies client **type inference**, not client runtime schema validation. With it, `partial` is `DeepPartial<T>` and `final` is `T | null`; final becomes available when the latest assistant structured-output part is complete. Server `chat({ outputSchema })` must validate independently. Treat partial fields, generated URLs, markdown, and even final model claims as untrusted data: no `v-html`, automatic navigation, SQL, executable code, or privileged tool authorization. Escaped text is the safe default; any richer renderer must sanitize HTML and constrain URL schemes/resources.

## Persistence, reconnection, and cancellation are separate

The Vue hook creates one client per setup and attaches on mount. Scope disposal detaches the reader, unsubscribes or stops local work, then disposes the client. Do not call the user's Stop action from unmount to implement this teardown. `forwardedProps`, `context`, `queue`, reactive tool refs/getters, and `live` have specific watchers; transport, `threadId`, and `outputSchema` are not general reactive reconfiguration. Remount to change identity. `context` is client-local; `forwardedProps` is wire JSON. The removed chat-level `body` option is not the still-valid adapter, generation, or per-send `body`. [Vue implementation](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/use-chat.ts).

- Default/`persistence: false`: browser memory only. A stable thread ID alone does not persist messages. A backend may independently retain requests: “ephemeral client” is not a data-retention guarantee.
- `persistence: true` plus a required stable `threadId`: server-authoritative hydration; needs an implemented authorized `hydrate` handler, and join/replay support for in-flight recovery. `history: { pageSize }` requests a newest-message window **only** in this server-persistence mode; otherwise hydration loads the full thread. Use `isHydrating`, `hasOlderMessages`, and guarded/awaited `loadOlderMessages()` for restoration/paging, preserving scroll position when older messages prepend. No automatic business mutation belongs in hydration.
- A client persistence adapter (`localStoragePersistence`, `sessionStoragePersistence`, `indexedDBPersistence`) stores transcript/resume state keyed by thread. Keep an identity-scoped namespace and remove data on logout according to policy. For 0.x upgrades, migrate old bare `UIMessage[]` records to the current `{ messages, ... }` storage contract before deploying, or discard only data whose retention policy permits it. Browser storage is not confidential server storage or a shared-device access control.
- SSE reconnection/delivery durability requires server event IDs, replay logs, terminal events, and compatible join semantics. The fetch adapter handles its own resumable protocol; do not assert that native browser `EventSource`/`Last-Event-ID` magically supplies durable chat. Truncation, incomplete durable runs, and exhausted reconnect bounds must be visible failures, not “complete” responses.
- `clear()` and unmount do not delete backend history. For explicit Stop only, `fetchServerSentEvents`/`fetchHttpStream` accept `cancelUrl`, or a custom connection can implement `cancelRun({ runId, threadId })`. The built-ins make a best-effort POST with those IDs and adapter-supplied headers/credentials; Stop does not await or report its outcome. Reload and ordinary Vue unmount are not server cancellation. Implement and authorize the route, and surface a separately confirmed outcome if required. [Exact cancellation implementation](https://unpkg.com/@tanstack/ai-client@1.2.1/src/connection-adapters.ts).

For resumable fetch/XHR, `reconnect` defaults to five consecutive **no-progress** retries, with jittered exponential backoff from `initialDelayMs: 250` to `maxDelayMs: 5000`; `delayMs` remains an alias. `budgetMs` bounds a no-progress window and replaces the default attempt cap unless `maxAttempts` is explicit. Progress resets both; neither is a global deadline. On resumable reconnects, transient 408/429/502/503/504 can retry and `Retry-After` is honored up to the delay cap. No resume cursor means a disconnected plain stream cannot be transparently replayed. Set independent server run/resource limits. [Client 1.0.0 reconnect change](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-client@1.0.0), [exact tracker](https://unpkg.com/@tanstack/ai-client@1.2.1/src/connection-adapters.ts).

## Generation: typed jobs, transforms, restoration, and media

Root exports `useGeneration`, `useGenerateImage`, `useGenerateAudio`, `useGenerateSpeech`, `useTranscription`, `useSummarize`, and `useGenerateVideo`. Use generic generation for an application-specific input/result contract; use a specialized hook only when the server emits the corresponding result. [Generation declaration](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/use-generation.d.ts), [input/event/fetcher contracts](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/generation-types.d.ts).

- Pass required `threadId` for **every** generation, even nonpersistent ones. Supply one real transport: a `ConnectConnectionAdapter` or `GenerationFetcher<TInput, TResult>`. The fetcher receives `(input, { signal, threadId, runId, headers? })` and returns `Promise<TResult | Response>`; a `Response` is parsed as SSE. Forward cancellation and authorized run context to the trusted backend. A built-in connection serializes generation inputs under AG-UI `forwardedProps`, with thread/run IDs in the envelope. A TanStack route can read these with `generationParamsFromRequest()` or `generationParamsFromBody()`. Connection mode consumes generation events (`generation:result`, `generation:artifacts`, `generation:progress`, video job/status events), not chat text deltas.
- Call `generate(input)` explicitly; mount never starts a new generation. Read readonly `result`, `isLoading`, `error`, `status` (`idle/generating/success/error`), `runId`. Only one generation runs per client; calling `generate` while busy is a no-op, **not** a queue or proof a second job was sent. Guard the UI and report the actual result/error.
- A concrete `onResult` return transforms and infers stored output; `null` preserves previous output; `void` stores raw output. Keep the return shape consistent. `onProgress(progress, message?)` reports 0–100. `onChunk` runs for connection streams **and fetchers returning an SSE `Response`**, not plain-object results; both streaming paths use the same processor. Keep notification callbacks non-throwing and do not log or announce each token/progress update. [Published processing branches](https://unpkg.com/@tanstack/ai-client@1.2.1/src/generation-client.ts).
- `stop()` aborts locally; capture `runId` for an authorized server cancellation service first. `reset()` clears local state/resume data, not backend history: a reload with server persistence can restore the last generation again.
- `persistence: true` requires a stable domain `threadId` naming the **generation slot**, not necessarily a chat. Supply authorized `hydrateGeneration` and `joinRun` handlers if the connection does not carry them; connection handlers take precedence. A restored running job without join support becomes interrupted/error. Specialized hooks reconstruct typed results from persisted activity/artifact fields; missing serve URLs can make a completed snapshot unrestorable. Fix persistence/asset-serving fields rather than hiding the error. Generic custom results need an application-specific reconstruction contract, not an assumption arbitrary JSON will repaint.

| Hook / input | Output and application decisions |
| --- | --- |
| `useGenerateImage` / `ImageGenerateInput` | `ImageGenerationResult`; `prompt` can be text or ordered text/image `MediaPrompt` parts; optional `numberOfImages`, `size`, `modelOptions`. Images can carry `url` or `b64Json`; do not hardcode PNG if the actual MIME differs. |
| `useGenerateAudio` / `AudioGenerateInput` | `AudioGenerationResult`; text `prompt`, optional `duration`/`modelOptions` for music or effects, not text-to-speech. |
| `useGenerateSpeech` / `SpeechGenerateInput` | `TTSResult`; choose `text` **or** multi-voice `turns`, not both; optional `voice`, `format`, `speed`, `timestamps`. Server adapter must advertise multi-speaker/timestamp capabilities before those requests are accepted. |
| `useTranscription` / `TranscriptionGenerateInput` | `TranscriptionResult`; `audio` is base64, `File`, `Blob`, or `ArrayBuffer`; optional `language`, `prompt`, `responseFormat`. Match the application's transport encoding and server upload policy; JSON does not serialize raw file bytes automatically. |
| `useSummarize` / `SummarizeGenerateInput` | `SummarizationResult`; `text`, optional `maxLength`, `style` (`bullet-points/paragraph/concise`), `focus`, `modelOptions`. Display/validate the result as untrusted text. |
| `useGenerateVideo` / `VideoGenerateInput` | `VideoGenerateResult` with completed `jobId`, `status`, `url`, optional expiry/artifacts. Text/image-conditioned `prompt`, backend-supported `size`, optional `duration`/`modelOptions`. Extra refs `jobId`, `videoStatus`; callbacks `onJobCreated(jobId)`, `onStatusUpdate(status)`. Connection mode delegates polling to the server; distinguish backend job ID from TanStack `runId`. |

Validate media URL scheme/origin, expiry and MIME before rendering/downloading; bound base64 size and provide alt descriptions, captions/transcripts, and explicit audio playback. [Pinned video API](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/use-generate-video.d.ts). [Vue 1.1.0](https://github.com/TanStack/ai/releases/tag/@tanstack/ai-vue@1.1.0) adds `useGenerate3DModel`, but the underlying 3D activity and core 1.7.0 motion generation are experimental; [core 1.8.0](https://github.com/TanStack/ai/releases/tag/%40tanstack%2Fai%401.8.0) only adds `'3mf'` to the 3D formats. These additions are not a viewer, provider capability, or reason to add a hosted adapter.

### Complete custom-generation pane

This SFC's host supplies a stable generation-slot `threadId` and a real, authorized, runtime-validating fetcher for the application-owned `{ text } → { summary }` contract. The parent keys the pane by authenticated identity, slot and fetcher configuration, so a change remounts it. It is a browser-side integration example, not an endpoint implementation. Its transform infers `result` as `string | null`.

```vue
<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue'
import { useGeneration } from '@tanstack/ai-vue'
import type { GenerationFetcher } from '@tanstack/ai-client'

type Input = { text: string }
type Result = { summary: string }
const props = defineProps<{
  threadId: string
  fetcher: GenerationFetcher<Input, Result>
}>()
const text = shallowRef('')
const actionFailed = shallowRef(false)
let attempt = 0
onScopeDispose(() => { ++attempt })
const { generate, result, isLoading, error, status, stop, reset } = useGeneration({
  threadId: props.threadId,
  fetcher: props.fetcher,
  onResult: value => value.summary.trim(),
})
const failed = computed(() => actionFailed.value || Boolean(error.value))

async function submit() {
  const input = text.value.trim()
  if (isLoading.value || !input) return
  const current = ++attempt
  actionFailed.value = false
  try {
    await generate({ text: input })
  } catch {
    if (current === attempt) actionFailed.value = true
  }
}

function cancel() {
  ++attempt
  stop()
}

function clearResult() {
  if (isLoading.value) return
  ++attempt
  reset()
  actionFailed.value = false
}
</script>

<template>
  <section aria-label="Text summary">
    <form @submit.prevent="submit">
      <label>
        Text to summarize
        <textarea v-model="text" :readonly="isLoading" />
      </label>
      <button type="submit" :disabled="isLoading || !text.trim()">Summarize</button>
      <button type="button" :disabled="!isLoading" @click="cancel">Stop locally</button>
      <button type="button" :disabled="isLoading" @click="clearResult">Clear result</button>
    </form>
    <p role="status" aria-live="polite">Generation: {{ status }}</p>
    <p v-if="failed" role="alert">Generation failed. Review the input and try again.</p>
    <p v-if="result !== null && status !== 'success'">This output does not confirm completion.</p>
    <p v-if="result !== null">{{ result }}</p>
  </section>
</template>
```

The fetcher forwards `signal`, `threadId`, `runId`, and applicable headers to its authorized endpoint. For JSON, check HTTP status, parse and runtime-validate `{ summary: string }`, then return that object. For SSE, check HTTP status and forward a valid `Response` with `RUN_STARTED`, optional `CUSTOM` `generation:progress`, `CUSTOM` `{ name: 'generation:result', value: { summary: string } }`, then successful `RUN_FINISHED` (or terminate with `RUN_ERROR`). Use the same run IDs and validate results at the actual service boundary. The current generation client sets `success` on `RUN_FINISHED`; for this contract, send that event only after a valid result. This is generation protocol, not chat text deltas.

Ordinary generation failures settle `generate()` with `error`/`status: 'error'`; a resolved promise is not proof of success. Premature EOF without a terminal event is a failure, not an idle job. A failed or stopped run does not automatically clear existing output; an SSE result can arrive before the terminal event. Read `status` independently and clear explicitly with `reset()`. User Stop aborts locally and returns an active run to `idle`; scope disposal ends local delivery and suppresses stale result ownership without issuing a server cancel or deleting history. The attempt counter guards this example's catch after stop, restart or unmount.

## Audio recording and multimodal submission

`useAudioRecorder` returns `start`, `stop`, `cancel`, readonly `isRecording`/`recording` refs, and **boolean** `isSupported`. Disable recording on unsupported browsers; start only from a deliberate user action after explaining microphone use. A raw `await stop()` returns `AudioRecording`: its `.part` goes into `sendMessage({ content: [recording.part] })`, `.base64` is available for generation input. Recording is not consent to upload; let the user review/discard or explicitly send, and apply upload limits. `cancel()` discards capture/releases the mic; scope disposal also cleans up.

The `onComplete(recording)` overload can asynchronously transform the result: its awaited non-void output becomes both `recording.value` and `await stop()`. Other recorder options without `onComplete` keep the raw recording type. Returning `void` keeps the raw value. `start`/`stop` reject **and** `onError` can notify; choose one UI error channel. `stop()` can reject with cancellation if `cancel()`/disposal wins the race, so do not submit a stale recording after logout/unmount. [Exact recorder overloads](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/use-audio-recorder.d.ts).

## WebMCP registration and discovery

Use `useRegisterWebMCPTools(tools, options?)` for scoped registration; the deprecated `useWebMCPTools` alias is removed in 1.x. Supply executable `.client()` tools, runtime `context` when required by their definitions, `toolOptions` keyed by name when needed, and an `onError` handler. The hook owns the abort signal; scope disposal unregisters its tools. This experimental browser capability registers nothing in unsupported browsers or SSR; that is not full-app SSR evidence. Hints/descriptions are not permissions.

`usePageWebMCPTools({ filter, onError })` returns a readonly reactive tool-list ref, initially empty; registration/removal updates it and scope disposal stops updates. Unsupported browsers and SSR keep it empty. Filter by trusted origin **and tool name** before passing the ref to `useChat({ tools: pageTools })`; setup-time dereferencing would freeze the snapshot. A failed discovery keeps the last list; surface the error and require an application policy decision before executing anything. Descriptions/results are untrusted model input. Keep a non-WebMCP path. [Vue declarations](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/use-web-mcp-tools.d.ts), [runtime contract](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/web-mcp-tools.d.ts).

## Targeted debugging workflow

| Symptom | Inspect before changing code |
| --- | --- |
| Template state appears stale | Top-level destructured refs auto-unwrap; refs nested in a plain `chat` object require `.value`. Do not copy the old blanket rule requiring `.value` in every template. Never mutate readonly snapshots. |
| Options seemingly ignored | Watcher-supported options need reactive reads from the original options object; transport/thread changes require identity-keyed remount. Replacing a plain captured value is not reactive configuration. |
| Chat unexpectedly sends again / appears twice | `append` invokes the model; `reload` regenerates; a second `useChat` in a widget creates a separate client. Import history with `setMessages` or the actual persistence workflow. |
| Missing parts, approvals, queue, or provider-context error | Confirm descriptor/provider identity, required `parts`/layout slots, typed registry keys, and queue widget; do not resolve an injection failure by constructing another client. |
| Reload shows empty or stuck generation | Check stable thread/slot identity, authorized hydrate response, join handler, terminal events, and persisted artifact serve URLs. A native SSE reconnect is not durable replay. |
| Tool approval rejected | Verify the bound interrupt and its thread/run/proposal identity, tool schema match, current authorization, and the actual resume response. Inspect safe status, never request credentials. |


## Verification boundary

The historical Vue 3.5.44 / adapter 0.27.0 / client 0.40.0 / AI 0.70.0 SFCs were exercised in production-built Chromium against deterministic local HTTP/SSE: chat partial/complete/error/stop/regenerate and identity remount isolation; generation JSON/SSE transformation/error/stop/reset/remount. See [verification evidence](../assets/verification.json) for those exact scopes. The 1.x changes above are manifest, release and source checks only, not a replay of those browser paths. Neither profile establishes inference, authentication, server authorization/cancellation, durable replay, tools/approvals/queue, specialized media, recording, WebMCP, SSR, or assistive-technology behavior. No hosted account is required or configured.

For the headless `/ui` entry, source-supported factories/registry/renderer contracts above are not a full strict-template or runtime pass. The full-profile failures and narrower SCRIPT/API-only profile are recorded separately in the entry-point boundary. The narrowed profile cannot certify renderer bindings or restore a full-template claim, even if all its negative assertions pass.

Application acceptance checks: initial/slow/empty stream; send guard; safe generic error before and after partial text; stop before/after first token; regenerate without duplicate user turns; disconnect/truncation/reconnect exhaustion; logout/account/thread switch during stream, tool execution, approval, and hydration; no stale repaint; server denial of forged IDs/tool results; resource/rate caps; credential redaction; keyboard-only cancel/recovery; screen-reader announcements without token floods; no HTML execution; backend retention/deletion/cancellation behavior independently confirmed.

## Sources

- [Vue 1.1.1 root exports](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/index.d.ts), [chat declarations](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/types.d.ts), and [implementation](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/use-chat.ts).
- [Client 1.2.1 types](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/types.d.ts), [adapter declarations](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/connection-adapters.d.ts), and [chat client](https://unpkg.com/@tanstack/ai-client@1.2.1/src/chat-client.ts).
- [Official Vue API](https://tanstack.com/ai/latest/docs/api/ai-vue), [Vue chat UI](https://tanstack.com/ai/latest/docs/ui/vue).
- [Vue 1.1.1 published UI source](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/ui.ts), [registry](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/create-ui.ts), and [bound factory](https://unpkg.com/@tanstack/ai-vue@1.1.1/src/chat-ui/create-chat-hook.ts).
- [Generation hook](https://unpkg.com/@tanstack/ai-vue@1.1.1/dist/use-generation.d.ts), [generation types/events](https://unpkg.com/@tanstack/ai-client@1.2.1/dist/esm/generation-types.d.ts), and [generation client](https://unpkg.com/@tanstack/ai-client@1.2.1/src/generation-client.ts).
