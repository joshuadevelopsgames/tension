"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LoginForm } from "./LoginForm";

import { SignUpForm } from "./SignUpForm";
import { startWindowDrag } from "@/lib/tauri";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
      } else {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen text-zinc-500 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl text-sm">
        {/* Top Header Bar */}
        <div
          onPointerDown={startWindowDrag}
          className="h-10 w-full shrink-0 border-b border-white/5 bg-zinc-900 flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
        >
          <div className="pl-16 text-[11px] font-medium text-zinc-500 tracking-wide">Tension</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen text-zinc-200 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl relative">
      {/* Top Header Bar */}
      <div
        onPointerDown={startWindowDrag}
        className="h-10 w-full shrink-0 border-b border-white/5 bg-zinc-900 flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
      >
        <div className="pl-16 text-[11px] font-medium text-zinc-500 tracking-wide">Tension</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-20">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-[18px] font-semibold text-zinc-100 tracking-tight mb-2">Tension</h1>
            <p className="text-[13px] text-zinc-500 font-medium pb-2 border-b border-white/5 mx-8">
              {isSignUp ? "Create a new workspace" : "Sign in to your workspace"}
            </p>
          </div>

          {isSignUp ? <SignUpForm /> : <LoginForm />}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
