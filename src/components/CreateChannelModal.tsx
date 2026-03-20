"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X, Hash, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

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

    // Insert channel
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

    // Add creator as first member
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
    <ModalPortal>
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--t-raised)] border border-[var(--t-border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Create a Channel</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Channel Name <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. nike-campaign-q3"
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            {slug && name && (
              <p className="text-[11px] text-zinc-600 pl-1">
                Slug: <span className="text-zinc-500 font-mono">{slug}</span>
              </p>
            )}
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Topic <span className="text-zinc-600 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          {/* Client + Campaign tags side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Client Tag
              </label>
              <input
                type="text"
                value={clientTag}
                onChange={(e) => setClientTag(e.target.value)}
                placeholder="e.g. Nike"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Campaign Tag
              </label>
              <input
                type="text"
                value={campaignTag}
                onChange={(e) => setCampaignTag(e.target.value)}
                placeholder="e.g. Q3-Launch"
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Private toggle */}
          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
              isPrivate
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                : "border-white/10 bg-black/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
            }`}
          >
            <Lock className={`w-4 h-4 shrink-0 ${isPrivate ? "text-indigo-400" : "text-zinc-600"}`} />
            <div>
              <p className="text-xs font-medium">
                {isPrivate ? "Private channel" : "Public channel"}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {isPrivate
                  ? "Only invited members can see and join"
                  : "Anyone in the workspace can see and join"}
              </p>
            </div>
            <div
              className={`ml-auto w-8 h-4.5 rounded-full transition-colors shrink-0 relative ${
                isPrivate ? "bg-indigo-600" : "bg-zinc-700"
              }`}
              style={{ height: "18px", width: "32px" }}
            >
              <span
                className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${
                  isPrivate ? "left-[14px]" : "left-0.5"
                }`}
              />
            </div>
          </button>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-3 border-t border-white/5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
