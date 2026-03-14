"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileAttachment } from "./FileAttachment";

type FileData = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  public_url: string;
};

export function MessageFiles({ messageId }: { messageId: string }) {
  const [files, setFiles] = useState<FileData[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("message_files")
      .select("id, file_name, file_size, mime_type, public_url")
      .eq("message_id", messageId)
      .then(({ data }) => setFiles(data ?? []));
  }, [messageId, supabase]);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {files.map((f) => (
        <FileAttachment key={f.id} file={f} />
      ))}
    </div>
  );
}
