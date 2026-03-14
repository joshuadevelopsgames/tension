"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";

export function SignUpForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        const { data, error: err } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
            }
        });

        setLoading(false);

        if (err) {
            setError(err.message);
            return;
        }

        // Email confirmation required: user exists but no session until they confirm
        if (data?.user && !data?.session) {
            setEmailSent(true);
            return;
        }

        setSuccess(true);
        // Delay redirect by 1.5s to give visual confirmation while DB provisions workspace
        setTimeout(() => {
            router.push("/");
            router.refresh();
        }, 1500);
    }

    if (emailSent) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2 border border-emerald-500/20">
                    <MailCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-100 tracking-tight">Check your email</h3>
                <p className="text-[13px] text-zinc-400 max-w-[260px] leading-relaxed">
                    We&apos;ve sent a confirmation link to <span className="text-zinc-200 font-medium">{email}</span>. Click the link to activate your workspace.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 text-[12px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="fullName" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 px-0.5">
                    Full Name
                </label>
                <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Jane Doe"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-[14px] text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 focus:ring-1 focus:ring-white/20 transition-colors placeholder-zinc-700"
                />
            </div>
            <div>
                <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 px-0.5 mt-2">
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="jane@example.com"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-[14px] text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 focus:ring-1 focus:ring-white/20 transition-colors placeholder-zinc-700"
                />
            </div>
            <div>
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 px-0.5 mt-2">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-[14px] text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 focus:ring-1 focus:ring-white/20 transition-colors placeholder-zinc-700"
                />
            </div>
            {error && <p className="text-xs text-red-400 font-medium px-0.5 mt-1">{error}</p>}
            {success && <p className="text-xs text-[#818cf8] font-medium px-0.5 mt-1 text-center">Account created! Preparing workspace...</p>}
            <button
                type="submit"
                disabled={loading || success}
                className="w-full rounded-lg bg-zinc-800 py-2.5 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors mt-6 border border-white/5"
            >
                {success ? "Welcome!" : loading ? "Creating account…" : "Sign Up"}
            </button>
        </form>
    );
}
