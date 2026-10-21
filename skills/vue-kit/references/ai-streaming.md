# AI streaming in Vue

Read when adding TanStack AI chat, tools, media generation, or bring-your-own-key (BYOK). This reference owns the browser stream lifecycle, not a production AI backend. Read [auth.md](auth.md) for identity and authorization, [accessibility.md](accessibility.md) for interaction, and [architecture-data.md](architecture-data.md) for durable data ownership.

## Version and entry-point boundary

Verified baseline: Vue **3.5.44**, `@tanstack/ai-vue` **0.27.0**, `@tanstack/ai-client` **0.40.0**, `@tanstack/ai` **0.70.0**. The Vue package peers on Vue `>=3.5.0` and AI `^0.70.0`; its client dependency is `^0.40.0`. These are **pre-1.0 releases**, not npm prerelease-tag versions; pin the coordinated versions and review release changes before upgrades. Do not borrow React hooks, React state access, or another AI SDK's message/tool names. [Package metadata](https://unpkg.com/@tanstack/ai-vue@0.27.0/package.json), [published exports](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/index.d.ts).

| Need | Verified Vue API / decision |
| --- | --- |
| Chat | `useChat` from `@tanstack/ai-vue`; return values are readonly refs and action methods. |
| Transport | Root re-exports include `fetchServerSentEvents`, `fetchHttpStream`, `xhrServerSentEvents`, `xhrHttpStream`, `stream`, `rpcStream`, `webSocket`, `fetchJson`, and `ConnectionAdapter`. Choose the server's actual protocol; arbitrary token text is not a TanStack AI event stream. |
| Reusable chat configuration | Root `createChatHook(options)` returns `{ useChat }`; call the bound composable in setup. Per-instance overrides: `threadId`, `live`, `forwardedProps`, deprecated `body`, `initialMessages`; not transport, schema, or tool definitions. |
| Typed client tools | Root re-exports `clientTools`, `createChatClientOptions`, `InferChatMessages`. Define shared schemas with `toolDefinition` from `@tanstack/ai`; implement browser-safe behavior with `.client()`. |
| BYOK | `useByok` is a **root** export. `defineByok`, `ByokClient`, `memoryStorage`, `passkeyStorage`, `defaultByokStorage`, `defineByokProvider`, and storage/crypto types/helpers come from **`@tanstack/ai-vue/byok`**. |
| Headless chat UI | `@tanstack/ai-vue/ui` exports its own `createChatHook`, `createChatUI`, and renderless `UIChat`, `UIProvider`, `UIMessages`, `UIMessage`, `UIPart`, `UIInterrupts`, `UIInterrupt`, `UIQueue`. Do not confuse its factory with the root factory. |

The `/ui` entry ships `.ts`/`.vue` source, requiring Vue SFC tooling and compatibility with the consumer's TypeScript settings. Its factory takes `{ options, components, partsComponents, toolsComponents, interruptsComponents }` and returns `{ useAppChat, ui, useChatContext }`; chrome needs layout/message components. Prefer this factory over deprecated prebuilt `Chat`, `ChatInput`, `ChatMessage`, `ChatMessages`, `ThinkingPart`, `TextPart`, and `ToolApproval`. A markdown/highlighter component is not permission to insert untrusted HTML. [Vue UI source](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/ui.ts), [UI guide](https://tanstack.com/ai/latest/docs/ui/vue).

## Ownership before implementation

1. Identify the existing backend, authentication mechanism, provider adapter, stream format, and whether a conversation is ephemeral or persisted. Do not create an imaginary `/api/chat` and describe it as functioning.
2. Give each mounted chat one identity: authenticated principal + tenant + conversation + transport/configuration revision. Remount on identity changes; do not mutate a connection's identity underneath an active client.
3. Require exactly one `connection` **or** `fetcher` in `UseChatOptions`. A fetcher receives the full transcript plus `threadId`/`runId` and `{ signal, headers? }`, returning `Response` or `AsyncIterable<StreamChunk>` (possibly asynchronously). It must forward abort and request headers. Prefer a standard adapter when the backend implements its protocol.
4. Keep application/provider secrets on the server. Never place them in `VITE_*`, client modules, rendered props, URLs, or browser storage. BYOK is an explicit exception for a user's own key, not a way to ship the application's key.
5. Treat messages, `forwardedProps`, tool advertisements/results, resume payloads, and IDs from a browser as untrusted. A `threadId` is a lookup key, not proof of ownership.

**Application-owned server responsibilities:** authenticate each send, hydration, join, live subscription, resume, cancellation, and history request; authorize principal/tenant/thread/run; enforce CSRF protection where applicable, model/provider/tool allowlists, input/token/upload limits, concurrent-run and rate/spend limits; validate tool arguments and outputs; authorize every side effect at execution time; propagate cancellation where supported; bound stream lifetime; redact provider errors and credentials. Build server prompts/policy from trusted configuration, not client-supplied system messages. Keep durable audit/persistence and idempotency for business operations server-side. A browser approval is user intent, not server authorization. These are architectural requirements, not guarantees of `useChat`.

## Chat state and commands

[Exact return/options declarations](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/types.d.ts), [client states and persistence](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/types.d.ts).

| Surface | Meaning and required handling |
| --- | --- |
| `messages` | Full `UIMessage[]`, each with `id`, `role`, `parts`; text is `{ type: 'text', content }`, not a message-wide `content` string. Render stable message IDs and explicitly handle supported parts. Do not expose internal `thinking` content by default. |
| `status` | `'ready' \| 'submitted' \| 'streaming' \| 'error'`; ready does not certify a saved conversation or completed provider work after cancellation. |
| `isLoading` | Request-local generation activity. Guard submissions and allow cancellation. `sessionGenerating` is shared-session activity; `connectionStatus` (`disconnected/connecting/connected/error`) and `isSubscribed` describe subscription lifecycle, not generation success. |
| `isHydrating` | Transcript restoration still in progress. Show loading rather than an empty-state claim; prevent sending against an unfinished restoration. |
| `sendMessage(textOrMultimodal, options?)` | Async send. `options.whenBusy` is `queue`, `drop`, or `interrupt`; queue only when the UI exposes queued items and `cancelQueued(id)`. A resolved dropped send does not mean delivery. The example disables concurrent sends instead. |
| `reload()` | Regenerates from the last user message, removes subsequent messages, and discards pending queued sends. This is a new model invocation, not a harmless read or guaranteed replay. |
| `stop()` | Aborts the local request, drops queued sends/resume state, and resets interrupts. A durable server run can continue. Capture `runId` before stopping if an authorized application cancellation service needs it. Never claim provider billing/work stopped solely because this method returned. |
| `clear()` / `setMessages()` | Client transcript changes, not a server deletion API or a business-data commit. `clear()` also cancels local work and removes client-adapter persistence when configured. Server data needs an explicit authorized deletion workflow. |
| `onChunk` / `onFinish` / `onError` | Lifecycle callbacks; avoid token-by-token analytics, secret/transcript logging, and business mutations on finish. Handle action rejection and the error ref without rendering raw provider errors. |

Use `.value` **in script**. Destructured top-level refs auto-unwrap **in Vue templates**: `v-for="message in messages"`, `:disabled="isLoading"`. If keeping the plain return object as `chat`, its nested refs require `chat.messages.value`; these are different access patterns, not contradictory SDK rules. State is not writable: call actions instead of assigning/pushing into returned refs. In 0.27.0 the implementation derives state from readonly computed snapshots; rely on the public ref contract, not a mutable shallow-ref implementation detail.

`append(message)` normally adds a model/UI message **and requests a response**; system messages are ignored, and frontend-only activity messages are appended without a run. Use `setMessages` for a client-only transcript replacement, not `append` as a passive history importer. Multimodal sends use `sendMessage({ content: [...] })`; enforce upload MIME/size/count limits on the server, not only in a file picker. Per-send `{ body }` merges forwarded JSON for that request; prefer the hook's `forwardedProps` for ongoing application parameters.

Callbacks also include `onResponse`, `onCustomEvent`, and `onInterruptStateChange`. The adapter reads the latest callback from the original options object at invocation time; a local variable reassignment does not mutate that object. Keep callbacks short and nonthrowing: a throwing callback can fail processing. `streamProcessor` configures client processing/batching, not provider rate limiting or durable delivery. `devtools` accepts display options; Vue/framework/hook metadata is injected. Enable transcript/tool inspection only under the application's data policy.

The hook's `queue` option accepts a `WhenBusy` shorthand, `QueueConfig`, or `QueueStrategy`. Config uses `whenBusy` (default `queue`), `drain: 'fifo' | 'batch'` (default FIFO), optional `maxSize` (unbounded if omitted), and `onOverflow: 'reject' | 'drop-oldest'`. Overflow `reject` silently drops the new send; it does not throw. Choose an explicit bound and show pending/evicted/not-delivered state. Batch drain merges queued items into one send after a successful run; do not imply each item remains a separate invocation. A strategy receives `{ pending, busyReason, queued }` and returns `{ action }`; strategy drain stays FIFO and per-send `whenBusy` wins. Concurrent streams are not supported.

## Complete browser pane with an explicit transport contract

The following two SFCs form a Vue-side integration example, **not a standalone server demo**. The host must supply an already-authorized `ConnectionAdapter` implementing the TanStack event protocol. No backend, provider key, fake stream, or endpoint implementation is supplied here. Create that adapter in the application's authenticated integration layer; standard SSE construction is `fetchServerSentEvents(actualAuthorizedUrl, () => actualFetchOptions)` with its verified `credentials`/`headers`/`fetchClient` options. The URL/options must come from real application configuration. Custom adapters must forward the provided abort signal and run-context headers. Never retarget an adapter across accounts.

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

`ChatPane.vue` is intentionally a **text-only, ephemeral** pane: no client tools registered, no tool approval UI, no automatic business actions, no storage option. Its server policy must disable tools for this surface. A received unsupported part is visibly unsupported rather than silently treated as text or executed.

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

const {
  messages, status, error, isLoading, isHydrating, resuming, interrupts,
  sendMessage, reload, stop, clear,
} = useChat({
  connection: props.connection,
  threadId: props.threadId,
  persistence: false,
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
  if (blocked.value || (kind === 'regenerate' && !canRegenerate.value)) return
  const text = draft.value.trim()
  if (kind === 'send' && !text) return
  const generation = ++actionGeneration
  acting.value = true
  actionFailed.value = false
  notice.value = 'Assistant response started.'
  if (kind === 'send') draft.value = ''
  try {
    if (kind === 'send') await sendMessage(text)
    else await reload()
    if (!mounted || generation !== actionGeneration) return
    if (error.value) {
      markIncomplete()
      notice.value = 'Response failed. Partial output may be incomplete.'
    } else if (interrupts.value.length) {
      notice.value = 'Response paused. This text-only pane cannot resolve tools.'
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
  stop()
  clear()
  draft.value = ''
})
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

Keep keyboard focus predictable: do not focus each streamed message or scroll users away from text they are reviewing. If an active cancel control becomes disabled, restore focus to the composer after the action if needed in the application's focus model. Add a user-controlled “Jump to latest” for long transcripts; do not make the transcript an assertive live region. The example uses a real form, persistent labels, polite start/end/cancel announcements, a separate generic error alert, preserved submitted text in the transcript, and explicit retry through regeneration rather than automatic duplicate sends. Its fixed DOM IDs assume one pane per page; assign instance-specific IDs for multiple panes.

## Headless UI registry, composition, and incumbent migration

Use the `/ui` factory when message/tool/interrupt widgets are shared, not merely to replace a small local pane. [Pinned registry implementation and prop types](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/create-ui.ts), [bound factory](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/create-chat-hook.ts).

1. Bind the real chat options and widget registry with `/ui` `createChatHook`. Call its `useAppChat({ threadId, ... })` once in the identity-owned setup, then render `UIChat` with that **same** `ui` and `chat`. Factory configuration may live at module scope only when it does not capture per-request credentials or user state.
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

Incumbent deprecated components remain usable before 1.0.0: old `Chat` owns a connection/options context; `ChatInput` uses controlled `v-model`/submit behavior, `ChatMessages` renders messages, `ChatMessage` renders one message, and `ToolApproval` takes proposal/approval props. Do not place them under a new provider and assume contexts are interchangeable. Migrate one identity-owned tree at a time: move the old connection/options to factory options, replace old `CHAT_KEY`/`useChatContext` consumers, port message content to the `parts` slot and part widgets, port approval to typed interrupt/tool props, then remove old imports (including the obsolete `@tanstack/ai-vue-ui` package name). Preserve keyboard, cancellation, and denial behavior during the cutover.

`TextPartProps` / `ThinkingPartProps` describe incumbent prebuilt renderers, **not** `PartProps`: text takes `content`, optional `role`, classes, markdown `extensions`, and `highlighter`; thinking takes `content` and optional `isComplete`. Highlighter output is trusted HTML, so only use an escaping highlighter and a constrained markdown/resource policy. A custom part widget receives `part.content` and can render escaped interpolation instead. Do not expose hidden reasoning merely because a thinking renderer exists. [Pinned incumbent props and deprecations](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/types.ts).

## Tools, approvals, and structured output

A tool-enabled surface must replace the text-only policy above with an intentional tool registry and UI. [Vue tool API](https://tanstack.com/ai/latest/docs/api/ai-vue), [tool declarations](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/types.d.ts).

- Define tool name/input/output schemas once; share browser-safe definitions, not server implementations or provider SDK imports. `clientTools(toolDefinitionResult.client(implementation), ...)` preserves tool-name typing; `createChatClientOptions` plus `InferChatMessages` can preserve that type across components. Registered client tools execute automatically; there is **no `onToolCall` option** to copy from another SDK. Keep privileged effects on the server.
- Tool-call states are `awaiting-input`, `input-streaming`, `input-complete`, `approval-requested`, `approval-responded`, `complete`, `error`. Never execute streamed/partial JSON arguments. Render each call by call ID, proposed action, validated arguments, approval state, and result/error. Tool-result states are `streaming`, `complete`, `error`; a denial/cancellation outcome can accompany error state.
- For legacy message-part approval, narrow `part.type === 'tool-call'`, `part.state === 'approval-requested'`, and `part.approval`; call `addToolApprovalResponse({ id: part.approval.id, approved })`. This is the **approval ID**, not `part.id`/the tool-call ID. Disable decisions during submission, catch rejection, and expose denial as a first-class action. Do not use a blanket “approve everything” control for sensitive tools.
- Prefer typed `interrupts` and their bound `resolveInterrupt` methods for current interrupt workflows. Inspect `kind`, `canResolve`, `status`, `errors`, and `resuming`; a `tool-approval` interrupt accepts an approval boolean and schema-dependent options, while generic interrupts accept their registered response payload. Unbound interrupts cannot be resolved by this client. `interruptErrors` and `retryInterrupts()` support recovery; do not manually forge resume items with `resumeInterruptsUnsafe` to bypass a failed approval. `pendingInterrupts` and `resumeInterrupts` are deprecated aliases.
- `resolveInterrupts(false)` supplies bulk approval denial; prefer per-item decisions for mixed or sensitive batches. Its resolver callback must invoke each selected interrupt's typed `resolveInterrupt(...)` and return `undefined`; it is not a generic `return true` mapper. Per-item `cancel()` / `clearResolution()` and batch `cancelInterrupts()` manage staged resolution, while `retryInterrupts()` retries failed submission. Use item status/errors plus batch errors and `resuming` to drive the UI; `canResolve` describes binding/schema capability and does not itself reflect expiry or in-flight submission. `initialResumeSnapshot` can seed descriptors for restored continuation, but must belong to the same authorized identity/thread; never trust browser resume state as server permission.
- Manual execution surfaces use `addToolResult({ toolCallId, tool, output, state?: 'output-available' | 'output-error', errorText? })`. Those submission-state names differ from rendered tool-call states. Do not add a second result for an automatically executed tool or rerun a side effect after a network error without server-side idempotency.
- Bind approval and tool execution to the current principal, tenant, thread, run, and proposal. Stop/unmount invalidates browser continuation, but cannot roll back completed tool effects. Async tool implementations need their own abort/identity discipline; no stale completion may mutate the next user's state.
- `outputSchema` supplies client **type inference**, not client runtime schema validation. With it, `partial` is `DeepPartial<T>` and `final` is `T | null`; final becomes available when the latest assistant structured-output part is complete. Server `chat({ outputSchema })` must validate independently. Treat partial fields, generated URLs, markdown, and even final model claims as untrusted data: no `v-html`, automatic navigation, SQL, executable code, or privileged tool authorization. Escaped text is the safe default; any richer renderer must sanitize HTML and constrain URL schemes/resources.

## Persistence, reconnection, and cancellation are separate

The composable creates one client per setup and attaches on mount. Scope disposal detaches, unsubscribes/stops, and disposes it. In 0.27.0, `forwardedProps`, deprecated `body`, `context`, `queue`, reactive tool refs/getters, and `live` changes have specific watchers; transport and `threadId` are not general reactive reconfiguration. Remount to change identity. `context` is client-local tool context, not serialized; `forwardedProps` is user-controlled wire JSON. [Implementation](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/use-chat.ts).

- Default/`persistence: false`: browser memory only. A stable thread ID alone does not persist messages. A backend may independently retain requests: “ephemeral client” is not a data-retention guarantee.
- `persistence: true` plus a required stable `threadId`: server-authoritative hydration; needs an implemented authorized `hydrate` handler, and join/replay support for in-flight recovery. `history: { pageSize }` requests a newest-message window **only** in this server-persistence mode; otherwise hydration loads the full thread. Use `isHydrating`, `hasOlderMessages`, and guarded/awaited `loadOlderMessages()` for restoration/paging, preserving scroll position when older messages prepend. No automatic business mutation belongs in hydration.
- A client persistence adapter (`localStoragePersistence`, `sessionStoragePersistence`, `indexedDBPersistence`) plus `threadId` stores transcript/resume state in the browser. Classify the data first; namespace by identity and remove it on logout according to retention policy. It is not confidential server storage, a shared-device access control, or a provider cancellation service.
- SSE reconnection/delivery durability requires server event IDs, replay logs, terminal events, and compatible join semantics. The fetch adapter handles its own resumable protocol; do not assert that native browser `EventSource`/`Last-Event-ID` magically supplies durable chat. Truncation, incomplete durable runs, and exhausted reconnect bounds must be visible failures, not “complete” responses.
- `clear()` and unmount do not delete backend history. `stop()` does not guarantee a durable server/provider job stopped. Durable cancellation requires an application-owned authenticated, authorized service keyed by the captured run ID and a backend that supports it; confirm its outcome independently.

## BYOK: user-owned secret boundary

`useByok(client)` subscribes to a `ByokClient` and unsubscribes on scope disposal. It returns one readonly snapshot ref with `status`, `locked`, `prompt`, and `storageError`; it does not render a key dialog or own authorization. Per-provider status is `empty`, `set`, `locked`, or `error`; masked previews are UI hints, not raw keys. [Exact API](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/byok/client.d.ts), [guide](https://tanstack.com/ai/latest/docs/advanced/byok).

**Contextual setup fragment**, to place inside the identity-keyed component's setup. It creates a complete memory-only keyring; its `byok` can be passed to `useChat` along with the real authorized connection and `byokProvider: () => 'openai'`. The selected provider must match a server-allowlisted provider. An existing password-input UI calls `saveUserKey(value)` directly from the user action and clears its draft after success; it must catch failure and announce a generic safe error. No server implementation is implied.

```ts
import { computed, onBeforeUnmount } from 'vue'
import { useByok } from '@tanstack/ai-vue'
import { defineByok, memoryStorage } from '@tanstack/ai-vue/byok'

const byok = defineByok({ storage: memoryStorage() })
const snapshot = useByok(byok)
const keyState = computed(() => snapshot.value.status.openai?.state ?? 'empty')

async function saveUserKey(value: string): Promise<void> {
  const key = value.trim()
  if (!key) throw new Error('Enter your own provider key.')
  await byok.update('openai', key)
}

onBeforeUnmount(() => { void byok.clear() })
```

- This exception is only for an informed user supplying **their own** provider credential. Explain provider costs, the relay that receives the secret, and deletion/revocation. XSS, compromised dependencies, browser extensions, and request inspection can expose a browser-held key; encryption at rest does not stop runtime compromise. Never put the key in Pinia persistence, hydration/SSR payloads, telemetry, crash reports, devtools snapshots, URLs, or transcripts. Use a password field with autocomplete disabled; do not display `byok.keys()` or call `headers()` for debugging.
- Keys are carried in `x-byok-*` **request headers**, not JSON. Fetch/XHR adapters forward them; custom connection adapters must copy `runContext.headers`, and custom fetchers must forward their `headers` argument to the intended relay. Set `byokProvider` or a matching `forwardedProps.provider`; unresolved provider sends fail rather than attaching every stored key. Send to HTTPS and an explicitly trusted destination, not user-selectable URLs.
- Headers are **not encryption** and do not guarantee nonretention: reverse proxies, observability agents, server errors, and provider clients must redact them. The relay sees the raw key and must use it request-locally without logging/persistence. Server helper `getByokKey` lives in `@tanstack/ai/byok/server`; its documented environment fallback must be an explicit product decision, not an accidental use of paid application credentials. Browser code must not import that server entry or provider implementation.
- `memoryStorage()` is explicitly nonpersistent. `defaultByokStorage()` can choose persistent passkey storage, falling back to memory; do not describe it as always memory-only. Passkey storage uses WebAuthn/PRF availability and unlock interaction. Call `update`, `unlock`, or `prepare` directly from fresh user activation, before unrelated awaits where required by the browser. Explain persistence and unlock before opting in; handle `storageError`, cancelled prompts, locked/missing keys, and unsupported storage. Never silently downgrade to plaintext storage.
- `byok.clear(provider?)` clears credentials; it is not provider-side key revocation. Clear the input draft, stop active streams/tools, discard the identity-owned keyring, and require a fresh context on logout/account change. `useByok` disposal only unsubscribes; it does not itself erase keys. Do not keep a module-global keyring across SSR users.

For custom providers/storage, `defineByok({ providers })` takes provider descriptors created with `defineByokProvider`; provider `with` companions are prepared/headered together, so audit every companion credential being prepared and sent. Await `byok.ready()` before a workflow that requires constructor hydration; use `snapshot.prompt.provider/reason` to choose missing-key versus unlock UI. `request(provider, reason)` requests UI; it does not collect a credential. `setServerCoverage` records known server environment coverage, not permission to leak a key or proof the server is authorized.

Prefer the built-in encrypted passkey storage over custom cryptography. An incumbent `KeyringStorage` adapter must declare `id`, `label`, `persistent`, optional `unlockable`/`warning`, implement `load`, `save`, `clear`, and optionally `peek` with **masked previews only**. Reject storage failures rather than pretending a persistent save succeeded. `/byok` exports `encryptKeyring`, `decryptKeyring`, and `deriveAesKey` for integrations; do not treat those low-level helpers as a full storage/access-control design. Custom storage needs an explicit encryption-key lifecycle, unlock, deletion, and shared-device policy; `persistent: true` alone guarantees none of them. [Storage contract](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/byok/storage.d.ts), [client methods](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/byok/client.d.ts).

## Generation: typed jobs, transforms, restoration, and media

Root exports `useGeneration`, `useGenerateImage`, `useGenerateAudio`, `useGenerateSpeech`, `useTranscription`, `useSummarize`, and `useGenerateVideo`. Use generic generation for an application-specific input/result contract; use specialized hooks when the server emits the corresponding activity result. [Generation declaration](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-generation.d.ts), [input/event/fetcher contracts](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/generation-types.d.ts).

- Supply exactly one real transport: a `ConnectConnectionAdapter`, or `GenerationFetcher<TInput, TResult>`. The latter receives `(input, options?)`, where options contain `signal` and optional headers, and returns `Promise<TResult | Response>`; a `Response` is parsed as SSE. Forward cancellation and BYOK headers to the trusted destination. Connection-mode generation consumes TanStack generation events (`generation:result`, `generation:artifacts`, `generation:progress`, video job/status events), not arbitrary chat text.
- Call `generate(input)` explicitly; mount never starts a new generation. Read readonly `result`, `isLoading`, `error`, `status` (`idle/generating/success/error`), `runId`. Only one generation runs per client; calling `generate` while busy is a no-op, **not** a queue or proof a second job was sent. Guard the UI and report the actual result/error.
- `onResult` returning a concrete value transforms/infer-types stored output; returning `null` preserves previous output; returning `void` stores raw output. A callback that sometimes returns transformed data and sometimes `void` can therefore store mixed shapes: keep the return contract consistent. `onProgress(progress, message?)` reports 0–100, `onChunk` is connection-mode only, and `onError` is an alternative error notification channel. Do not announce/log every progress chunk or duplicate errors through every channel.
- `stop()` aborts locally; capture `runId` for an authorized server cancellation service first. `reset()` clears local state/resume data, not backend history: a reload with server persistence can restore the last generation again.
- `persistence: true` requires a stable domain `threadId` naming the **generation slot**, not necessarily a chat. Supply authorized `hydrateGeneration` and `joinRun` handlers if the connection does not carry them; connection handlers take precedence. A restored running job without join support becomes interrupted/error. Specialized hooks reconstruct typed results from persisted activity/artifact fields; missing serve URLs can make a completed snapshot unrestorable. Fix persistence/asset-serving fields rather than hiding the error. Generic custom results need an application-specific reconstruction contract, not an assumption arbitrary JSON will repaint.

| Hook / input | Output and application decisions |
| --- | --- |
| `useGenerateImage` / `ImageGenerateInput` | `ImageGenerationResult`; `prompt` can be text or ordered text/image `MediaPrompt` parts; optional `numberOfImages`, `size`, `modelOptions`. Images can carry `url` or `b64Json`; do not hardcode PNG if the actual MIME differs. |
| `useGenerateAudio` / `AudioGenerateInput` | `AudioGenerationResult`; text `prompt`, optional `duration`/`modelOptions` for music or effects, not text-to-speech. |
| `useGenerateSpeech` / `SpeechGenerateInput` | `TTSResult`; choose `text` **or** multi-voice `turns`, not both; optional `voice`, `format`, `speed`, `timestamps`. Server adapter must advertise multi-speaker/timestamp capabilities before those requests are accepted. |
| `useTranscription` / `TranscriptionGenerateInput` | `TranscriptionResult`; `audio` is base64, `File`, `Blob`, or `ArrayBuffer`; optional `language`, `prompt`, `responseFormat`. Match the application's transport encoding and server upload policy; JSON does not serialize raw file bytes automatically. |
| `useSummarize` / `SummarizeGenerateInput` | `SummarizationResult`; `text`, optional `maxLength`, `style` (`bullet-points/paragraph/concise`), `focus`, `modelOptions`. Display/validate the result as untrusted text. |
| `useGenerateVideo` / `VideoGenerateInput` | `VideoGenerateResult` with completed `jobId`, `status`, `url`, optional expiry/artifacts. Text/image-conditioned `prompt`, provider-specific `size`, optional `duration`/`modelOptions`. Extra refs `jobId`, `videoStatus`; callbacks `onJobCreated(jobId)`, `onStatusUpdate(status)`. Connection mode delegates polling to the server; distinguish provider job ID from TanStack `runId`. |

Validate media URL scheme/origin, expiry and MIME before rendering/downloading; bound base64 payload size; provide alt descriptions, captions/transcripts, and explicit audio playback. Capability/type acceptance does not mean every provider supports every option. [Pinned video API](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-generate-video.d.ts).

### Complete custom-generation pane

This SFC's host supplies a real, authorized, runtime-validating `fetcher` for the declared application-owned `{ text } → { summary }` contract. It is a Vue integration example, not an endpoint implementation. Remount it when authenticated identity or fetcher configuration changes. The transform has a single concrete return shape and infers `result` as `string | null`.

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useGeneration } from '@tanstack/ai-vue'
import type { GenerationFetcher } from '@tanstack/ai-client'

type Input = { text: string }
type Result = { summary: string }
const props = defineProps<{ fetcher: GenerationFetcher<Input, Result> }>()
const text = shallowRef('')
const actionFailed = shallowRef(false)
const { generate, result, isLoading, error, status, stop, reset } = useGeneration({
  fetcher: props.fetcher,
  onResult: value => value.summary.trim(),
})
const failed = computed(() => actionFailed.value || Boolean(error.value))

async function submit() {
  if (isLoading.value || !text.value.trim()) return
  actionFailed.value = false
  try {
    await generate({ text: text.value.trim() })
  } catch {
    actionFailed.value = true
  }
}

function clearResult() {
  if (isLoading.value) return
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
      <button type="button" :disabled="!isLoading" @click="stop">Stop locally</button>
      <button type="button" :disabled="isLoading" @click="clearResult">Clear result</button>
    </form>
    <p role="status" aria-live="polite">Generation: {{ status }}</p>
    <p v-if="failed" role="alert">Generation failed. Review the input and try again.</p>
    <p v-if="result !== null">{{ result }}</p>
  </section>
</template>
```

## Audio recording and multimodal submission

`useAudioRecorder` returns `start`, `stop`, `cancel`, readonly `isRecording`/`recording` refs, and **boolean** `isSupported`. Disable recording on unsupported browsers; start only from a deliberate user action after explaining microphone use. A raw `await stop()` returns `AudioRecording`: its `.part` goes into `sendMessage({ content: [recording.part] })`, `.base64` is available for generation input. Recording is not consent to upload; let the user review/discard or explicitly send, and apply upload limits. `cancel()` discards capture/releases the mic; scope disposal also cleans up.

The `onComplete(recording)` overload can asynchronously transform the result: its awaited non-void output becomes both `recording.value` and `await stop()`. Other recorder options without `onComplete` keep the raw recording type. Returning `void` keeps the raw value. `start`/`stop` reject **and** `onError` can notify; choose one UI error channel. `stop()` can reject with cancellation if `cancel()`/disposal wins the race, so do not submit a stale recording after logout/unmount. [Exact recorder overloads](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-audio-recorder.d.ts).

## WebMCP registration and discovery

Use `useRegisterWebMCPTools(tools, options?)` for scoped registration; `useWebMCPTools` remains a deprecated alias until 1.0.0. Supply executable `.client()` tools, required runtime `context` when inferred by their definitions, optional `toolOptions` keyed by tool name (`title`, `annotations.readOnlyHint/untrustedContentHint`), and `onError` for asynchronous registration failures. The hook owns the abort signal; scope disposal unregisters its tools. Unsupported browsers and SSR perform no registration. Hints/descriptions are not permissions or proof a tool is harmless.

`usePageWebMCPTools({ filter, onError })` returns a readonly reactive tool-list ref, initially empty; registration/removal updates it, scope disposal stops updates, and unsupported browsers/SSR keep it empty. Filter by explicit trusted origin **and tool name** before passing that ref to `useChat({ tools: pageTools })`; never dereference it once at setup and expect discovery changes to propagate. A failed discovery read keeps the last list, so surface the error and make an application policy decision before further execution. Page-tool descriptions/results are untrusted model input; registration/discovery does not authorize privileged browser operations. Preserve a non-WebMCP interaction path rather than assuming browser support. [Vue declarations](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-web-mcp-tools.d.ts), [runtime registration/discovery contracts](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/web-mcp-tools.d.ts).

## Targeted debugging workflow

| Symptom | Inspect before changing code |
| --- | --- |
| Template state appears stale | Top-level destructured refs auto-unwrap; refs nested in a plain `chat` object require `.value`. Do not copy the old blanket rule requiring `.value` in every template. Never mutate readonly snapshots. |
| Options seemingly ignored | Watcher-supported options need reactive reads from the original options object; transport/thread changes require identity-keyed remount. Replacing a plain captured value is not reactive configuration. |
| Chat unexpectedly sends again / appears twice | `append` invokes the model; `reload` regenerates; a second `useChat` in a widget creates a separate client. Import history with `setMessages` or the actual persistence workflow. |
| Missing parts, approvals, queue, or provider-context error | Confirm descriptor/provider identity, required `parts`/layout slots, typed registry keys, and queue widget; do not resolve an injection failure by constructing another client. |
| Reload shows empty or stuck generation | Check stable thread/slot identity, authorized hydrate response, join handler, terminal events, and persisted artifact serve URLs. A native SSE reconnect is not durable replay. |
| Tool approval rejected / BYOK absent | Approval uses `approval.id`; BYOK needs an explicitly resolved provider and forwarded run headers. Inspect only redacted status, never raw headers/keys. |


## Verification boundary

Pinned exports/declarations, adapter implementation and primary docs ground these integration examples. Chat SFCs require the declared application transport; custom generation requires the declared fetcher; the BYOK fence is contextual setup. Executed compiler/type scopes are in the [verification record](../assets/verification.json). No real provider call, deployed transport or end-to-end authorization test is claimed.

Application acceptance checks: initial/slow/empty stream; send guard; safe generic error before and after partial text; stop before/after first token; regenerate without duplicate user turns; disconnect/truncation/reconnect exhaustion; logout/account/thread switch during stream, tool execution, approval, and hydration; no stale repaint; server denial of forged IDs/tool results; cost/rate caps; BYOK missing/locked/cleared key and header redaction; keyboard-only cancel/recovery; screen-reader announcements without token floods; no HTML execution; backend retention/deletion/cancellation behavior independently confirmed.

## Sources

- [Vue package 0.27.0 metadata](https://unpkg.com/@tanstack/ai-vue@0.27.0/package.json), [root exports](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/index.d.ts), [chat types](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/types.d.ts), [chat implementation](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/use-chat.ts).
- [Client 0.40.0 states/tools/persistence](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/types.d.ts), [transport declarations](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/connection-adapters.d.ts), [chat cancellation/regeneration implementation](https://unpkg.com/@tanstack/ai-client@0.40.0/src/chat-client.ts).
- [Official Vue API](https://tanstack.com/ai/latest/docs/api/ai-vue), [Vue chat UI](https://tanstack.com/ai/latest/docs/ui/vue), [BYOK guide](https://tanstack.com/ai/latest/docs/advanced/byok), [BYOK client types](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/byok/client.d.ts), [memory storage implementation](https://unpkg.com/@tanstack/ai-client@0.40.0/src/byok/storage.ts).
- [Pinned UI registry/props](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/create-ui.ts), [factory](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/create-chat-hook.ts), [incumbent renderer props](https://unpkg.com/@tanstack/ai-vue@0.27.0/src/chat-ui/types.ts).
- [Generation hook](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-generation.d.ts), [generation types/events](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/generation-types.d.ts), [client restoration/reset contract](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/generation-client.d.ts), [video](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-generate-video.d.ts), [recorder overloads](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-audio-recorder.d.ts).
- [BYOK storage](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/byok/storage.d.ts), [Vue WebMCP hooks](https://unpkg.com/@tanstack/ai-vue@0.27.0/dist/use-web-mcp-tools.d.ts), [WebMCP runtime](https://unpkg.com/@tanstack/ai-client@0.40.0/dist/esm/web-mcp-tools.d.ts).
