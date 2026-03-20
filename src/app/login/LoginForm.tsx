"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    
    const demoEmail = "demo@example.com";
    const demoPassword = "demo-password-123";

    let { error: err } = await supabase.auth.signInWithPassword({ 
      email: demoEmail, 
      password: demoPassword 
    });

    // If sign in fails, try signing up the demo user
    if (err && err.message.includes("Invalid login credentials")) {
      const { error: signUpErr } = await supabase.auth.signUp({ 
        email: demoEmail, 
        password: demoPassword 
      });
      err = signUpErr;
    }

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 px-0.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-[14px] text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 focus:ring-1 focus:ring-white/20 transition-colors"
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
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2.5 text-[14px] text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-black/60 focus:ring-1 focus:ring-white/20 transition-colors"
          />
        </div>
        {error && <p className="text-xs text-red-400 font-medium px-0.5 mt-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-800 py-2.5 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-colors mt-6 border border-white/5"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="relative border-t border-white/10 my-4 flex justify-center">
        <span className="absolute -top-3 bg-[#0a0a0a] px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Or</span>
      </div>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading}
        className="w-full rounded-lg py-2.5 text-[13px] font-semibold disabled:opacity-50 transition-colors" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)", color: "var(--t-accent)", border: "1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)" }}
      >
        {loading ? "Please wait…" : "Demo Login"}
      </button>
    </div>
  );
}
