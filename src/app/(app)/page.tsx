import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h2 className="text-xl font-medium text-[#a5b4fc] mb-2">Welcome</h2>
      <p className="text-[#a1a1aa] mb-4">
        Pick a channel from the sidebar or create one to start.
      </p>
      <Link
        href="/channels"
        className="text-sm text-[#818cf8] hover:underline"
      >
        View all channels
      </Link>
    </div>
  );
}
