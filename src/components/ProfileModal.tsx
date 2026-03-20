"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Loader2, X } from "lucide-react";
import { ModalPortal } from "@/components/ModalPortal";

const STATUS_EMOJIS = [
  "😊","😄","😂","😅","🤔","🤩","😎","🥳","😴","🤒","😤","🥹",
  "🔥","✅","🚀","💯","👀","💡","⚡","🎯","📌","⚠️","🏆","✨",
  "👍","👎","❤️","🎉","💪","🫡","🙏","💀","🤝","👋","🫶","🎊",
  "☕","🍕","🎸","⚽","🌴","🏖️","🌙","☀️","🌧️","❄️","🌈","🎁",
];

export function ProfileModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; avatar_url: string | null; bio: string | null; status: string | null } | null>(null);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("active");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    
    async function loadProfile() {
      setLoading(true);
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        console.error("Auth error:", authErr);
        onClose();
        return;
      }
      
      const { data, error: fetchErr } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (fetchErr && fetchErr.code !== "PGRST116") {
        // PGRST116 = row not found, which is expected for users created before the trigger
        console.error("Profile fetch error:", fetchErr);
      }
      if (data) {
        setProfile({ id: data.id, full_name: data.full_name, avatar_url: data.avatar_url, bio: data.bio, status: data.status });
        setFullName(data.full_name || "");
        setBio(data.bio || "");
        setStatus(data.status || "active");
        setStatusEmoji(data.status_emoji || "");
        setStatusMessage(data.status_message || "");
        setAvatarUrl(data.avatar_url);
      } else {
        // No profile row yet (pre-trigger user) — set the user id so upsert works
        setProfile({ id: user.id, full_name: null, avatar_url: null, bio: null, status: null });
      }
      setLoading(false);
    }
    
    loadProfile();
  }, [isOpen, supabase, onClose]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingAvatar(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/avatar_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      alert(`Upload failed: ${uploadError.message}. Make sure the 'avatars' bucket exists in your Supabase Storage dashboard.`);
    } else {
      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(fileName);
      setAvatarUrl(publicUrl.publicUrl);
    }
    
    setUploadingAvatar(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    setSaving(true);
    const { error } = await supabase.from("users").upsert({
      id: profile.id,
      full_name: fullName,
      bio: bio,
      avatar_url: avatarUrl,
      status: status,
      status_emoji: statusEmoji,
      status_message: statusMessage,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { onConflict: "id" });
    
    if (error) {
      console.error("Profile save error:", error);
      alert(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }
    
    setSaving(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-zinc-900/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ boxShadow:'0px 24px 48px rgba(0,0,0,0.6)', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', Arial, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <h2 className="text-[15px] font-medium tracking-tight text-white">Edit Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 flex justify-center items-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div 
                className="relative w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700/50 flex items-center justify-center overflow-hidden cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-zinc-600 select-none">
                    {fullName.slice(0, 2).toUpperCase() || profile?.id.slice(0, 2).toUpperCase()}
                  </span>
                )}
                
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <Camera className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <p className="text-[11px] text-zinc-500 font-medium tracking-wide">CLICK TO UPLOAD</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Bio (Optional)</label>
                <input
                  type="text"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  placeholder="What do you do?"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Status Message</label>
                <div className="flex gap-2">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen((o) => !o)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg border text-lg transition-colors ${emojiPickerOpen ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}
                    >
                      {statusEmoji || "😀"}
                    </button>
                    {emojiPickerOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl p-2 shadow-2xl grid grid-cols-6 gap-0.5 z-[300] w-48 max-h-48 overflow-y-auto">
                        {STATUS_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => { setStatusEmoji(e); setEmojiPickerOpen(false); }}
                            className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-white/10 transition-colors"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={statusMessage}
                    onChange={e => setStatusMessage(e.target.value)}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    placeholder="What's your status?"
                    maxLength={80}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["active", "away", "busy", "offline"] as const).map((s) => {
                    const colors: Record<string, string> = {
                      active: "bg-emerald-500",
                      away: "bg-amber-500",
                      busy: "bg-red-500",
                      offline: "bg-zinc-500",
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs font-medium transition-colors ${
                          status === s
                            ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
                            : "border-white/10 bg-black/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colors[s]}`} />
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
