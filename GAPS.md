# Tension — Feature Gap Analysis
_Last updated: March 14, 2026_

## Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript
- **Desktop:** Tauri 2
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage)
- **Security:** Row Level Security (RLS) on all tables

---

## What's Already Built ✅

| Feature | Status | Notes |
|---|---|---|
| Email auth (login/signup) | ✅ Done | Demo login included |
| Workspace auto-creation | ✅ Done | Created on signup via trigger |
| Channel list + view | ✅ Done | With client/campaign tags |
| Real-time messaging | ✅ Done | Supabase Realtime, optimistic UI |
| Message deduplication & grouping | ✅ Done | Grouped by sender, collapses timestamps |
| User profile editing | ✅ Done | `ProfileModal.tsx` — name, bio, avatar upload |
| Avatar uploads | ✅ Done | Supabase Storage, public bucket |
| Command palette (⌘K) | ✅ Partial | Channel jumping works; search not wired up |
| Thread schema | ✅ Schema only | `parent_id` on messages, no UI |
| DM schema | ✅ Schema only | `dm_conversations` + `dm_participants` tables, no UI |
| Message approvals schema | ✅ Schema only | `message_approvals` table, no UI |
| RLS / workspace isolation | ✅ Done | All tables secured |

---

## What's Missing ❌

### 🔴 High Priority (Core Slack Features)

#### 1. Direct Messages (DMs)
- **Gap:** Schema is 100% ready (`dm_conversations`, `dm_participants`), but there is zero UI.
- **Needed:** DM list in sidebar, DM conversation view, "New DM" modal to pick a user, realtime subscription mirroring channels.
- **Effort:** Medium — mirrors channel UI, schema already done.

#### 2. Threads
- **Gap:** `parent_id` on `messages` exists, but `ChannelView` filters it out entirely (`is("parent_id", null)`). No thread UI at all.
- **Needed:** Thread indicator on messages ("3 replies"), slide-in thread panel, thread reply composer, thread reply count badge.
- **Effort:** Medium-High.

#### 3. Channel Creation UI
- **Gap:** Channels currently only exist via seed SQL. There is no "Create Channel" button in the UI.
- **Needed:** Modal with name, optional topic, client/campaign tag fields. Insert into `channels` + `channel_members`.
- **Effort:** Low-Medium.

#### 4. Member Management UI
- **Gap:** Tables exist (`workspace_members`, `channel_members`) but there's no UI to invite, add, or remove members.
- **Needed:** Invite by email flow, member list, role management (owner/admin/member), remove from workspace.
- **Effort:** Medium.

#### 5. Message Search
- **Gap:** Command palette has a search box but it's not wired to anything.
- **Needed:** At minimum, SQL `ILIKE` search on `messages.body`. Filter by channel, sender, date range. Highlight matches.
- **Effort:** Medium.

---

### 🟡 Medium Priority (Collaboration Quality)

#### 6. Message Reactions / Emoji
- **Gap:** No schema, no UI.
- **Needed:** `message_reactions` table (`message_id`, `user_id`, `emoji`), emoji picker on hover, reaction display with counts.
- **Effort:** Medium.

#### 7. Message Editing & Deletion
- **Gap:** No edit/delete actions on messages, no RLS update/delete policies.
- **Needed:** Right-click or hover menu → Edit (inline), Delete (with confirmation). "edited" label on modified messages.
- **Effort:** Low-Medium.

#### 8. File Attachments in Messages
- **Gap:** Only avatar uploads work. No way to attach files to messages.
- **Needed:** File metadata table, upload to Supabase Storage, attachment display in message bubble, drag-and-drop.
- **Effort:** Medium-High.

#### 9. Notifications & @Mentions
- **Gap:** No `notifications` table, no detection of `@username` in message body.
- **Needed:** Detect `@name` on insert (Postgres trigger or app logic), notification record per mentioned user, badge count in sidebar, toast popup.
- **Effort:** Medium-High.

#### 10. User Status / Presence
- **Gap:** `users.status` column exists but is never set or displayed.
- **Needed:** Status dot on avatars (online/away/busy/offline), status picker in profile menu, realtime presence via Supabase Presence channel.
- **Effort:** Medium.

#### 11. View Other Users' Profiles
- **Gap:** `ProfileModal` is edit-only (your own profile). No way to click another user's avatar and see their info.
- **Needed:** Read-only profile popover/modal when clicking any user avatar, showing name, bio, status.
- **Effort:** Low.

---

### 🟢 Lower Priority (Polish & Power Features)

#### 12. Multi-Workspace Switching
- **Gap:** Workspace is auto-created but there's no UI to create additional workspaces or switch between them.
- **Needed:** Workspace selector (top-left dropdown), create workspace flow, workspace settings.
- **Effort:** Medium.

#### 13. Message Formatting (Markdown/Rich Text)
- **Gap:** Messages are plain text only.
- **Needed:** Basic markdown rendering (bold, italic, code, links). Optional: rich text editor (e.g., TipTap or Lexical).
- **Effort:** Medium.

#### 14. Pinned Messages
- **Gap:** No schema, no UI.
- **Needed:** `pinned_messages` table, "Pin" action on message hover menu, pinned messages panel in channel.
- **Effort:** Low-Medium.

#### 15. Saved/Bookmarked Messages
- **Gap:** No schema, no UI.
- **Needed:** `saved_messages` table, save action, "Saved Items" view in sidebar.
- **Effort:** Low.

#### 16. Channel Settings / Edit
- **Gap:** No way to edit a channel's name, topic, or tags after creation.
- **Needed:** Channel settings modal (name, topic, client_tag, campaign_tag, archive).
- **Effort:** Low.

#### 17. User Directory
- **Gap:** No way to browse/search all members in a workspace.
- **Needed:** "People" section in sidebar or command palette, searchable list, click to DM or view profile.
- **Effort:** Low.

---

### 🤖 AI Features (From PRODUCT.md — Not Started)

All planned AI features are unimplemented. These are the ones called out in the product doc:

- Thread/campaign summarization
- Semantic message search (vector embeddings)
- Smart daily/weekly digests
- Draft reply suggestions
- Auto-generate creative briefs from context
- Urgency & sentiment flagging
- Approval workflow AI suggestions
- Link unfurl + AI summary
- Auto-tagging of messages by client/campaign
- Translation

**Prerequisite before any AI work:** Message search (#5 above) and a vector column on messages (e.g., `pgvector` extension in Supabase).

---

## Suggested Build Order

1. **Channel creation UI** — unblocks testing everything else
2. **DM UI** — schema is ready, high user value
3. **Thread UI** — schema is ready, high user value
4. **Message editing/deletion** — basic hygiene
5. **Message search** — wires up existing command palette
6. **Member management** — invite + manage users
7. **Reactions** — needs new table + UI
8. **File attachments** — needs new table + storage
9. **Notifications / @mentions** — needs new table + logic
10. **User status/presence** — small but visible quality bump
11. **View other profiles** — small lift, high perceived value
12. **Message formatting** — polish
13. **AI features** — after core is solid

---

## Note on Profile Editing

> Profile editing **is already implemented** in `ProfileModal.tsx` — it supports editing full name, bio, and uploading an avatar photo. It's accessible from the user settings button in the sidebar. What's _missing_ is the ability to **view other users' profiles** (read-only) and to **set a status** (the schema column exists but isn't wired up).
