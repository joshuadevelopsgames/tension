"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ModalPortal";

type ChannelFields = {
  id: string;
  name: string;
  topic: string | null;
  client_tag: string | null;
  campaign_tag: string | null;
};

export function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelFields;
  onSaved: (updated: ChannelFields) => void;
}) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [clientTag, setClientTag] = useState(channel.client_tag ?? "");
  const [campaignTag, setCampaignTag] = useState(channel.campaign_tag ?? "");
  const [saving, setSaving] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const supabase = createClient();

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("channels")
      .update({
        name: name.trim(),
        topic: topic.trim() || null,
        client_tag: clientTag.trim() || null,
        campaign_tag: campaignTag.trim() || null,
      })
      .eq("id", channel.id);

    setSaving(false);
    if (!error) {
      onSaved({
        ...channel,
        name: name.trim(),
        topic: topic.trim() || null,
        client_tag: clientTag.trim() || null,
        campaign_tag: campaignTag.trim() || null,
      });
      onClose();
    }
  }

  async function handleArchive() {
    await supabase.from("channels").update({ is_archived: true }).eq("id", channel.id);
    onClose();
    window.location.href = "/";
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <div
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Channel Settings</h2>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Channel Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                placeholder="channel-name"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                placeholder="What's this channel about?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Client Tag</label>
                <input
                  value={clientTag}
                  onChange={(e) => setClientTag(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  placeholder="acme-corp"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Campaign Tag</label>
                <input
                  value={campaignTag}
                  onChange={(e) => setCampaignTag(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  placeholder="q2-brand"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>

            <div className="border-t border-white/5 pt-3">
              {archiveConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 flex-1">Archive this channel?</span>
                  <button onClick={handleArchive} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors">
                    Yes, archive
                  </button>
                  <button onClick={() => setArchiveConfirm(false)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setArchiveConfirm(true)}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Archive channel…
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
