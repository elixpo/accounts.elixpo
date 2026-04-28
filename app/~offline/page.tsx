"use client";

import Image from "next/image";
import Link from "next/link";


export default function OfflinePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 selection:bg-white/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-800/40 via-[#0a0a0a] to-[#0a0a0a] -z-10" />

            <div className="w-full max-w-md flex flex-col items-center text-center space-y-6">
                <div className="relative w-20 h-20 mb-4 opacity-50 grayscale">
                    <Image
                        src="/LOGO/logo.png"
                        alt="Elixpo Logo"
                        fill
                        className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                        priority
                    />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">You're offline</h1>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                        It looks like you've lost your internet connection. Please check your network and try again.
                    </p>
                </div>

                <div className="pt-6 w-full flex flex-col gap-3">
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300
                        bg-white text-black hover:bg-neutral-200 active:scale-[0.98] 
                        shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300
                        bg-white/5 text-white hover:bg-white/10 active:scale-[0.98]
                        border border-white/10"
                    >
                        Go to Home
                    </Link>
                </div>
            </div>
            
            <div className="absolute bottom-8 text-xs text-neutral-600 font-medium tracking-wide">
                ELIXPO ACCOUNTS
            </div>
        </div>
    );
}
