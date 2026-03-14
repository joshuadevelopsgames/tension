"use client";

import { FileText, Image as ImageIcon, Download, File } from "lucide-react";

type FileData = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  public_url: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachment({ file }: { file: FileData }) {
  const isImage = file.mime_type.startsWith("image/");

  if (isImage) {
    return (
      <div className="mt-2 max-w-xs rounded-lg overflow-hidden border border-white/10 bg-black/20">
        <img
          src={file.public_url}
          alt={file.file_name}
          className="max-w-full max-h-64 object-contain"
          loading="lazy"
        />
        <div className="px-3 py-1.5 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 truncate">{file.file_name}</span>
          <a
            href={file.public_url}
            download={file.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Download className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  const Icon = file.mime_type.includes("pdf") ? FileText :
               file.mime_type.includes("text") ? FileText : File;

  return (
    <a
      href={file.public_url}
      download={file.file_name}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-3 max-w-xs p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
    >
      <div className="w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-300 truncate">{file.file_name}</p>
        <p className="text-[11px] text-zinc-600">{formatSize(file.file_size)}</p>
      </div>
      <Download className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
    </a>
  );
}
