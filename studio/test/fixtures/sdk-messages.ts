import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export const init = {
  type: "system",
  subtype: "init",
  session_id: "sess-1",
  uuid: "00000000-0000-4000-8000-000000000001",
  cwd: "/repo",
  tools: ["Bash", "Read", "Write", "Edit", "Skill"],
  model: "claude-opus-5-5",
  permissionMode: "default",
} as unknown as SDKMessage;

export const assistantWithToolAndText = {
  type: "assistant",
  session_id: "sess-1",
  uuid: "00000000-0000-4000-8000-000000000002",
  parent_tool_use_id: null,
  message: {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason: "tool_use",
    content: [
      { type: "thinking", thinking: "plan the treatment", signature: "sig" },
      { type: "text", text: "  Writing the treatment.\n" },
      { type: "text", text: "   " },
      {
        type: "tool_use",
        id: "toolu_1",
        name: "Bash",
        input: { command: "npm run stills -- rain-cat" },
      },
    ],
  },
} as unknown as SDKMessage;

export const resultSuccess = {
  type: "result",
  subtype: "success",
  session_id: "sess-1",
  uuid: "00000000-0000-4000-8000-000000000003",
  is_error: false,
  duration_ms: 120000,
  duration_api_ms: 100000,
  num_turns: 12,
  result: "Plan ready.",
  stop_reason: "end_turn",
  total_cost_usd: 0.42,
  permission_denials: [],
} as unknown as SDKMessage;

export const resultMaxTurns = {
  type: "result",
  subtype: "error_max_turns",
  session_id: "sess-1",
  uuid: "00000000-0000-4000-8000-000000000004",
  is_error: true,
  duration_ms: 300000,
  duration_api_ms: 280000,
  num_turns: 60,
  stop_reason: null,
  total_cost_usd: 3.1,
  permission_denials: [],
  errors: [],
} as unknown as SDKMessage;
