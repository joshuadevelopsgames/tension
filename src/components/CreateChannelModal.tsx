"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Hash, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors";
const inputStyle = {
  background: "var(--t-surface)",
  border: "1px solid var(--t-border)",
  color: "var(--t-fg)",
} as React.CSSProperties;

export function CreateChannelModal({
  isOpen,
  onClose,
  workspaceId,
  onChannelCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onChannelCreated: (channel: { id: string; name: string; slug: string }) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [clientTag, setClientTag] = useState("");
  const [campaignTag, setCampaignTag] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = toSlug(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        slug,
        topic: topic.trim() || null,
        client_tag: clientTag.trim() || null,
        campaign_tag: campaignTag.trim() || null,
        is_private: isPrivate,
      })
      .select("id, name, slug")
      .single();

    if (channelError || !channel) {
      setError(channelError?.message ?? "Failed to create channel.");
      setSaving(false);
      return;
    }

    await supabase.from("channel_members").insert({
      channel_id: channel.id,
      user_id: user.id,
    });

    onChannelCreated(channel);
    setSaving(false);
    handleClose();
    router.push(`/channel?id=${channel.id}`);
  }

  function handleClose() {
    setName("");
    setTopic("");
    setClientTag("");
    setCampaignTag("");
    setIsPrivate(false);
    setError(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <Modal title="Create a Channel" onClose={handleClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--t-fg-2)" }}>
            Channel Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Hash
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "var(--t-fg-3)" }}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. nike-campaign-q3"
              className={`${inputClass} pl-8`}
              style={inputStyle}
            />
          </div>
          {slug && name && (
            <p className="text-[11px] pl-1" style={{ color: "var(--t-fg-3)" }}>
              Slug: <span className="font-mono" style={{ color: "var(--t-fg-2)" }}>{slug}</span>
            </p>
          )}
        </div>

        {/* Topic */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--t-fg-2)" }}>
            Topic <span className="font-normal normal-case" style={{ color: "var(--t-fg-3)" }}>(optional)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's this channel about?"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Client + Campaign tags */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--t-fg-2)" }}>
              Client Tag
            </label>
            <input
              type="text"
              value={clientTag}
              onChange={(e) => setClientTag(e.target.value)}
              placeholder="e.g. Nike"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--t-fg-2)" }}>
              Campaign Tag
            </label>
            <input
              type="text"
              value={campaignTag}
              onChange={(e) => setCampaignTag(e.target.value)}
              placeholder="e.g. Q3-Launch"
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Private toggle */}
        <button
          type="button"
          onClick={() => setIsPrivate((p) => !p)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors"
          style={{
            borderColor: isPrivate
              ? "color-mix(in srgb, var(--t-accent) 40%, transparent)"
              : "var(--t-border)",
            background: isPrivate
              ? "color-mix(in srgb, var(--t-accent) 10%, transparent)"
              : "transparent",
            color: isPrivate ? "var(--t-accent)" : "var(--t-fg-2)",
          }}
        >
          <Lock className="w-4 h-4 shrink-0" style={{ color: isPrivate ? "var(--t-accent)" : "var(--t-fg-3)" }} />
          <div>
            <p className="text-xs font-medium">
              {isPrivate ? "Private channel" : "Public channel"}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--t-fg-3)" }}>
              {isPrivate
                ? "Only invited members can see and join"
                : "Anyone in the workspace can see and join"}
            </p>
          </div>
          <div
            className="ml-auto rounded-full transition-colors shrink-0 relative"
            style={{
              height: 18,
              width: 32,
              background: isPrivate ? "var(--t-accent)" : "var(--t-border)",
            }}
          >
            <span
              className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all"
              style={{ left: isPrivate ? 14 : 2 }}
            />
          </div>
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-3" style={{ borderTop: "1px solid var(--t-border)" }}>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: "var(--t-fg-2)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 flex items-center gap-2 text-white"
            style={{ background: "var(--t-accent)" }}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Channel
          </button>
        </div>
      </form>
    </Modal>
  );
}
