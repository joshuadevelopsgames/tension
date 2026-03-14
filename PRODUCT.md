# Slack for Marketing — Product Scope

## What marketing companies use Slack for (replace these)

- **Channels**: by client, campaign, department (e.g. `#acme-q2`, `#creative`, `#paid-social`)
- **DMs & group DMs**: quick coordination, client-handoff chats
- **Threads**: campaign feedback, creative review, approval discussions
- **Files & links**: decks, assets, briefs, ad previews
- **Search**: messages and files by client/campaign/keyword
- **Notifications**: @mentions, reminders, deadline nudges
- **Integrations**: calendar, project tools, ad platforms (Meta, Google, etc.)
- **Internal vs client**: clear separation (internal channels vs client-facing or shared)

---

## AI advantages (Slack lacks or does weakly)

| Feature | What it does |
|--------|----------------|
| **Thread/campaign summarization** | One-click AI summary of long threads or whole channel; "what was decided" and open questions. |
| **Semantic search** | "Where did we discuss Q2 budget for Acme?" without exact keywords. |
| **Smart digests** | Daily/weekly digest per client or campaign: key decisions, blockers, next steps. |
| **Draft replies** | Suggest reply from thread context; tone options (formal for client, casual internal). |
| **Brief-from-context** | Generate creative/campaign brief from channel + thread history. |
| **Urgency & sentiment** | Flag high-urgency or negative-sentiment messages; suggest prioritization. |
| **Approval workflows** | Suggest approvers from content; track "needs sign-off" and surface in a list. |
| **Link unfurl + summary** | Unfurl links with AI summary (deck, article, ad) instead of generic preview. |
| **Meeting/call notes** | Paste or sync notes → searchable summary + action items + link to relevant channels. |
| **Auto-tagging** | Tag messages/channels by client, campaign, type (brief, feedback, approval) for filters. |
| **Translation** | One-click translate for global teams and client messages. |
| **Status from activity** | Auto-draft status updates ("This week: …") from your recent messages and threads. |

---

## Build order (this repo)

1. Core: workspaces, channels, DMs, messages, threads, realtime.
2. Marketing layer: client/campaign on channels and messages; optional approval state.
3. Search (text first; semantic later).
4. AI: start with summarization and draft replies, then digests and semantic search.
