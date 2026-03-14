"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ChannelsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<any[]>([]);
  const [hasWorkspace, setHasWorkspace] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .single();
        
      if (!membership?.workspace_id) {
        setHasWorkspace(false);
        setLoading(false);
        return;
      }
      
      const { data: channelsData } = await supabase
        .from("channels")
        .select("id, name, slug, topic, client_tag, campaign_tag")
        .eq("workspace_id", membership.workspace_id)
        .order("name");
        
      setChannels(channelsData ?? []);
      setLoading(false);
    }
    
    load();
  }, [router]);

  if (loading) return <div className="p-4 text-[#71717a]">Loading channels...</div>;
  if (!hasWorkspace) return <p className="p-4 text-[#71717a]">No workspace.</p>;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
      <h2 className="text-lg font-medium text-[#e4e4e7] mb-4">Channels</h2>
      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.id}>
            <Link
              href={`/channel?id=${ch.id}`}
              className="block rounded-lg border border-[#2d2d44] bg-[#16162a] p-4 hover:border-[#3d3d5c]"
            >
              <span className="font-medium text-[#a5b4fc]"># {ch.name}</span>
              {(ch.client_tag || ch.campaign_tag) && (
                <span className="ml-2 text-xs text-[#71717a]">
                  {[ch.client_tag, ch.campaign_tag].filter(Boolean).join(" · ")}
                </span>
              )}
              {ch.topic && (
                <p className="text-sm text-[#a1a1aa] mt-1">{ch.topic}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
