"use client";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type NavItem = "playground" | "api-reference";

type UserResponse = { id: string; type: string; name: string | null; pennId: string | null };
type ChatsResponse = { chats: Array<{ id: string; title: string }> };

type ApiState<T> = { status: "idle" | "loading" | "success" | "error"; data: T | null; error: string | null };

function idle<T>(): ApiState<T> {
  return { status: "idle", data: null, error: null };
}

// ── Shared style ───────────────────────────────────────────────────────────────

const prose: React.CSSProperties = {
  color: "#4b5563",
  fontSize: 14,
  lineHeight: 1.7,
  margin: "0 0 16px",
};

// ── Page component ─────────────────────────────────────────────────────────────

export default function PlatformPlaygroundPage() {
  const [activeNav, setActiveNav] = useState<NavItem>("playground");
  const [userApi, setUserApi] = useState<ApiState<UserResponse>>(idle());
  const [chatsApi, setChatsApi] = useState<ApiState<ChatsResponse>>(idle());

  async function runUserApi() {
    setUserApi({ status: "loading", data: null, error: null });
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserResponse = await res.json();
      setUserApi({ status: "success", data, error: null });
    } catch (err) {
      setUserApi({ status: "error", data: null, error: String(err) });
    }
  }

  async function runChatsApi() {
    setChatsApi({ status: "loading", data: null, error: null });
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ChatsResponse = await res.json();
      setChatsApi({ status: "success", data, error: null });
    } catch (err) {
      setChatsApi({ status: "error", data: null, error: String(err) });
    }
  }

  const NAV_ITEMS: Array<{ id: NavItem; label: string; render: () => React.ReactNode }> = [
    {
      id: "playground",
      label: "Playground",
      render: () => (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "#0d0d0d" }}>Playground</h2>
          <p style={{ ...prose, marginBottom: 28 }}>
            Invoke platform APIs directly from your browser. Responses reflect your current session.
          </p>
          <ApiCard
            title="User API"
            description="Returns the current session's user record. name and pennId are null for anonymous users (v1 — populated after SSO)."
            endpoint="GET /api/me"
            apiState={userApi}
            onRun={runUserApi}
            renderResult={(data) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <LabeledRow label="ID" value={data.id} />
                <LabeledRow label="Type" value={data.type} />
                <LabeledRow label="Name" value={data.name} nullable />
                <LabeledRow label="Penn ID" value={data.pennId} nullable />
              </div>
            )}
          />
          <ApiCard
            title="Chats API"
            description="Returns all chats for the current session. Identity is resolved via cookie automatically."
            endpoint="GET /api/chats"
            apiState={chatsApi}
            onRun={runChatsApi}
            renderResult={(data) => {
              const chats = data.chats;
              if (chats.length === 0) {
                return <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No chats yet.</p>;
              }
              return (
                <div>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
                    {chats.length} chat{chats.length !== 1 ? "s" : ""}
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                    {chats.map((chat) => (
                      <li key={chat.id} style={{ fontSize: 13, color: "#374151" }}>
                        {chat.title}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            }}
          />
        </div>
      ),
    },
    {
      id: "api-reference",
      label: "API Reference",
      render: () => (
        <div>
          <header style={{ marginBottom: 48 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.1em",
                color: "#011F5B",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Platform Team
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 12px", color: "#0d0d0d" }}>
              Platform API Reference
            </h1>
            <p style={{ color: "#6e6e80", fontSize: 15, margin: 0, lineHeight: 1.6, maxWidth: 580 }}>
              Everything available to your tool via <Code>ToolContext</Code>. Your{" "}
              <Code>execute(input, context)</Code> method receives a fully-constructed context — import nothing
              from <Code>@penntools/platform</Code> or env vars directly.
            </p>
          </header>

          <Section title="ToolContext" badge="Entry point" badgeColor="#011F5B">
            <p style={prose}>
              The second argument to <Code>execute()</Code>. All platform services are accessed through this
              object.
            </p>
            <CodeBlock>{`interface ToolContext {
  userId:      UserId;          // anonymous UUID of the caller
  currentUser: User;            // full user record (name/pennId null until SSO)

  db: {
    chats:    ChatRepository;
    messages: MessageRepository;
    toolData: ToolDataRepository;
    users:    UserRepository;
  };

  llm:       LLMProvider;       // LLM completions & streaming
  analytics: Analytics;         // event tracking
  logger:    Logger;            // structured logging
  config:    ToolConfig;        // injected config; toolId always present
}`}</CodeBlock>
            <CalloutBox>
              Tools may <strong>read</strong> anything on <Code>context</Code> but must{" "}
              <strong>never</strong> import <Code>@penntools/platform</Code>, <Code>process.env</Code>,{" "}
              <Code>fetch</Code>, or Prisma directly.
            </CalloutBox>
          </Section>

          <Section title="LLMProvider" badge="context.llm" badgeColor="#1a56a4">
            <p style={prose}>
              Vendor-agnostic LLM interface. Works with OpenAI and Anthropic adapters interchangeably.
            </p>
            <CodeBlock>{`interface LLMProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest):   AsyncGenerator<StreamChunk>;
  readonly providerName: string;        // e.g. "anthropic" | "openai"
}

interface CompletionRequest {
  messages:     LLMMessage[];   // { role, content }[]
  systemPrompt?: string;
  maxTokens?:   number;
  temperature?: number;         // 0–1
  model?:       string;         // override; platform default used if omitted
}

interface CompletionResponse {
  content: string;
  model:   string;              // actual model used (may differ from request)
  usage: {
    promptTokens:     number;
    completionTokens: number;
    totalTokens:      number;
  };
}

interface StreamChunk {
  delta: string;
  done:  boolean;
}`}</CodeBlock>
            <UsageExample>{`// Non-streaming completion
const res = await context.llm.complete({
  messages: [{ role: "user", content: input.prompt }],
  systemPrompt: "You are a helpful Penn assistant.",
  temperature: 0.7,
});
return { assistantMessage: res.content, telemetry: { durationMs: 0, tokensUsed: res.usage.totalTokens } };

// Streaming (for real-time UI)
for await (const chunk of context.llm.stream({ messages })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}`}</UsageExample>
          </Section>

          <Section title="ChatRepository" badge="context.db.chats" badgeColor="#2d7a4f">
            <CodeBlock>{`interface ChatRepository {
  findById(id: ChatId):                          Promise<Chat | null>;
  findAllByUser(userId: UserId):                 Promise<Chat[]>;
  create(input: CreateChatInput):                Promise<Chat>;
  update(id: ChatId, input: UpdateChatInput):    Promise<Chat>;
  delete(id: ChatId):                            Promise<void>;
}

interface CreateChatInput { userId: UserId; title: string; }
interface UpdateChatInput { title?: string; }

interface Chat {
  id:        ChatId;
  userId:    UserId;
  title:     string;
  createdAt: Date;
  updatedAt: Date;
}`}</CodeBlock>
          </Section>

          <Section title="MessageRepository" badge="context.db.messages" badgeColor="#2d7a4f">
            <CodeBlock>{`interface MessageRepository {
  findById(id: MessageId):          Promise<Message | null>;
  findByChatId(chatId: ChatId):     Promise<Message[]>;
  create(input: CreateMessageInput): Promise<Message>;
  deleteByChatId(chatId: ChatId):   Promise<void>;  // hard delete
}

interface CreateMessageInput {
  chatId:  ChatId;
  userId:  UserId;
  role:    MessageRole;   // "user" | "assistant" | "tool"
  content: string;
  toolId?: string;        // set when role === "tool"
}

interface Message {
  id:        MessageId;
  chatId:    ChatId;
  userId:    UserId;
  role:      MessageRole;
  content:   string;
  toolId:    string | null;
  createdAt: Date;
}`}</CodeBlock>
          </Section>

          <Section title="ToolDataRepository" badge="context.db.toolData" badgeColor="#2d7a4f">
            <p style={prose}>
              Per-user, per-tool key-value store. Great for persisting tool state without needing your own DB
              table.
            </p>
            <CodeBlock>{`interface ToolDataRepository {
  get(userId: UserId, toolId: string, key: string): Promise<ToolData | null>;
  upsert(input: UpsertToolDataInput):               Promise<ToolData>;
  deleteByUser(userId: UserId, toolId: string):     Promise<void>;
}

interface UpsertToolDataInput {
  userId:    UserId;
  toolId:    string;
  key:       string;
  jsonValue: Record<string, any>;  // arbitrary JSON
}

interface ToolData {
  id:        ToolDataId;
  userId:    UserId;
  toolId:    string;
  key:       string;
  jsonValue: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}`}</CodeBlock>
            <UsageExample>{`// Save user preferences
await context.db.toolData.upsert({
  userId:    context.userId,
  toolId:    context.config.toolId,
  key:       "preferences",
  jsonValue: { theme: "dark", language: "en" },
});

// Load them back
const record = await context.db.toolData.get(context.userId, context.config.toolId, "preferences");
const prefs = record?.jsonValue ?? {};`}</UsageExample>
          </Section>

          <Section title="UserRepository" badge="context.db.users" badgeColor="#2d7a4f">
            <CodeBlock>{`interface UserRepository {
  findById(id: UserId):                                      Promise<User | null>;
  findByPennId(pennId: string):                              Promise<User | null>;
  create(input: CreateUserInput):                            Promise<User>;
  updateProfile(id: UserId, input: UpdateProfileInput):      Promise<User>;
}

interface User {
  id:        UserId;       // UUID; stable across sessions
  type:      UserType;     // "anonymous" | "authenticated"
  name:      string | null;   // null until SSO login (v2)
  pennId:    string | null;   // null until SSO login (v2)
  createdAt: Date;
}`}</CodeBlock>
            <CalloutBox>
              In v1 all users are <Code>anonymous</Code>. <Code>context.currentUser</Code> is already resolved
              — tools rarely need to call <Code>context.db.users</Code> directly.
            </CalloutBox>
          </Section>

          <Section title="Analytics" badge="context.analytics" badgeColor="#7c3aed">
            <p style={prose}>
              Vendor-agnostic analytics interface (PostHog in production, no-op in dev/tests).
            </p>
            <CodeBlock>{`interface Analytics {
  track(userId: UserId, event: string, props?: EventProperties): void;
  identify(userId: UserId, traits?: EventProperties):            void;
  flush():                                                       Promise<void>;
}

// EventProperties = Record<string, string | number | boolean | null>
// Flat key-value only — no nested objects (compatibility with all backends).`}</CodeBlock>
            <UsageExample>{`context.analytics.track(context.userId, "tool_executed", {
  toolId:     context.config.toolId,
  tokensUsed: res.usage.totalTokens,
  success:    true,
});

// Call flush() at the end of serverless functions so events aren't dropped
await context.analytics.flush();`}</UsageExample>
          </Section>

          <Section title="Logger" badge="context.logger" badgeColor="#b45309">
            <p style={prose}>
              Structured logger — prefer this over <Code>console.log</Code> for easier log aggregation.
            </p>
            <CodeBlock>{`interface Logger {
  info(message: string,  meta?: Record<string, unknown>): void;
  warn(message: string,  meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown):               void;
}`}</CodeBlock>
            <UsageExample>{`context.logger.info("Tool started", { userId: context.userId, input });
context.logger.warn("Slow response", { durationMs: elapsed });
context.logger.error("LLM call failed", err);`}</UsageExample>
          </Section>

          <Section title="Tool Base Class" badge="@penntools/core/tools" badgeColor="#011F5B">
            <p style={prose}>
              Every tool extends <Code>Tool{"<I, O>"}</Code> and implements two members.
            </p>
            <CodeBlock>{`abstract class Tool<I = unknown, O extends ToolOutput = ToolOutput> {
  abstract readonly manifest: ToolManifest;
  abstract execute(input: I, context: ToolContext): Promise<O>;

  // Override to restrict access by userId (default: allow all)
  canAccess(_userId: UserId): boolean { return true; }
}

interface ToolOutput {
  assistantMessage: string;      // required — shown in chat thread
  artifacts?:       Artifact[];  // optional rich output
  telemetry?:       ToolTelemetry;
}

interface ToolTelemetry {
  durationMs:  number;
  tokensUsed?: number;
  meta?:       Record<string, unknown>;
}

interface Artifact {
  kind:  "text" | "json" | "link" | "image";
  label: string;
  data:  any;
}

interface ToolManifest {
  id:                string;   // stable kebab-case; never change after ship
  title:             string;
  description:       string;
  image:             string;   // relative path or URL
  contributors:      string[];
  mentor?:           string;
  version:           string;   // semver
  inceptionDate:     string;   // ISO date
  latestReleaseDate: string;   // ISO date
}`}</CodeBlock>
          </Section>
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        background: "var(--bg, #fff)",
        borderTop: "1px solid #e5e5e5",
      }}
    >
      {/* Left nav — never scrolls, only 2 items */}
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #e5e5e5",
          padding: "56px 0 32px",
        }}
      >
        <div style={{ padding: "0 16px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af" }}>
          Platform Playground
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeNav;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 20px",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#011F5B" : "#374151",
                background: isActive ? "#f0f4ff" : "transparent",
                border: "none",
                borderLeft: isActive ? "3px solid #011F5B" : "3px solid transparent",
                cursor: "pointer",
                marginBottom: 1,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right panel — only this scrolls when content overflows */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "48px 48px 80px" }}>
        {NAV_ITEMS.find((item) => item.id === activeNav)?.render()}
      </main>
    </div>
  );
}

// ── ApiCard ────────────────────────────────────────────────────────────────────

function ApiCard<T>({
  title,
  description,
  endpoint,
  apiState,
  onRun,
  renderResult,
}: {
  title: string;
  description: string;
  endpoint: string;
  apiState: ApiState<T>;
  onRun: () => void;
  renderResult: (data: T) => React.ReactNode;
}) {
  const isLoading = apiState.status === "loading";
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: "20px 22px",
        marginBottom: 20,
        background: "#fff",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0d0d0d" }}>{title}</span>
        <Code>{endpoint}</Code>
        <button
          onClick={onRun}
          disabled={isLoading}
          style={{
            marginLeft: "auto",
            background: "#011F5B",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? "Running…" : "Run"}
        </button>
      </div>

      {/* Description */}
      <p style={{ ...prose, marginBottom: apiState.status === "idle" ? 0 : 14 }}>{description}</p>

      {/* Result panel */}
      {apiState.status === "loading" && (
        <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Running…</p>
      )}
      {apiState.status === "error" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {apiState.error}
        </div>
      )}
      {apiState.status === "success" && apiState.data !== null && (
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "12px 16px",
          }}
        >
          {renderResult(apiState.data)}
        </div>
      )}
    </div>
  );
}

// ── LabeledRow ─────────────────────────────────────────────────────────────────

function LabeledRow({ label, value, nullable }: { label: string; value: string | null; nullable?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
      <span style={{ color: "#6b7280", width: 72, flexShrink: 0 }}>{label}</span>
      {value === null && nullable ? (
        <em style={{ color: "#9ca3af" }}>null</em>
      ) : (
        <span style={{ color: "#111827", fontFamily: "ui-monospace, monospace" }}>{value}</span>
      )}
    </div>
  );
}

// ── Presentational helpers (unchanged) ─────────────────────────────────────────

function Section({
  title,
  badge,
  badgeColor,
  children,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0d0d0d" }}>{title}</h2>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: "#fff",
            background: badgeColor,
            borderRadius: 4,
            padding: "2px 8px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {badge}
        </span>
      </div>
      {children}
      <hr style={{ border: "none", borderTop: "1px solid #e5e5e5", margin: "32px 0 0" }} />
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: "0.85em",
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: 3,
        padding: "1px 5px",
        color: "#374151",
      }}
    >
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#f8f9fa",
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        padding: "18px 20px",
        fontSize: 13,
        lineHeight: 1.65,
        overflowX: "auto",
        margin: "0 0 16px",
        color: "#1a1a2e",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
      }}
    >
      {children}
    </pre>
  );
}

function UsageExample({ children }: { children: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#8e8ea0",
          marginBottom: 6,
        }}
      >
        Example
      </div>
      <pre
        style={{
          background: "#0d1117",
          color: "#c9d1d9",
          borderRadius: 8,
          padding: "18px 20px",
          fontSize: 13,
          lineHeight: 1.65,
          overflowX: "auto",
          margin: "0 0 16px",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        }}
      >
        {children}
      </pre>
    </div>
  );
}

function CalloutBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderLeft: "4px solid #011F5B",
        borderRadius: 6,
        padding: "12px 16px",
        fontSize: 13,
        color: "#1e3a5f",
        lineHeight: 1.6,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}
