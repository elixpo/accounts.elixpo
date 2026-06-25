"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Copy, Check } from "lucide-react";

const EMAIL = "hello@elixpo.com";
const REPO_URL = "https://github.com/elixpo/accounts.elixpo";

const navLinks = [
    { label: "Sign in", href: "/login" },
    { label: "About", href: "/about" },
    { label: "Docs", href: "/docs" },
    { label: "Integrator guide", href: "/docs" },
];

const Github = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <title>GitHub Logo</title>
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
);

export default function Footer() {
    const [copied, setCopied] = useState(false);

    const handleCopyEmail = async () => {
        try {
            await navigator.clipboard.writeText(EMAIL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = EMAIL;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                window.location.href = `mailto:${EMAIL}`;
            }
            document.body.removeChild(ta);
        }
    };

    return (
        <footer className="bg-[#F2F2EE] text-[#192837] border-t border-[#192837]/10 py-16 relative z-10 w-full font-body">
            <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
                <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
                    <div className="max-w-sm">
                        <div className="flex items-center gap-2.5 mb-4">
                            <img
                                src="/LOGO/logo.png"
                                alt="Elixpo Mascot"
                                className="w-8 h-8 rounded-lg object-contain bg-white/85 p-0.5"
                            />
                            <span className="font-heading text-xl font-bold">
                                Elixpo <span className="text-[#7342E2]">Accounts</span>
                            </span>
                        </div>
                        <p className="text-sm opacity-80 leading-relaxed">
                            Open OAuth 2.0 single sign-on, built on the edge. Drop it into any app
                            — Elixpo or yours — and let users sign in with one account.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-12 sm:gap-16">
                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4">
                                Navigate
                            </h4>
                            <ul className="flex flex-col gap-3 text-sm font-semibold">
                                {navLinks.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="hover:opacity-75 transition-opacity"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-4">
                                Get in Touch
                            </h4>
                            <div className="flex flex-col gap-4 items-start">
                                <button
                                    onClick={handleCopyEmail}
                                    className="flex items-center gap-2 border border-[#192837]/10 bg-white hover:bg-[#192837]/5 px-4 py-2 rounded-xl text-sm font-semibold transition-all relative overflow-hidden active:scale-[0.98]"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-green-600" />
                                            <span className="text-green-600 font-medium">
                                                Copied!
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4 text-[#192837]" />
                                            <span>{EMAIL}</span>
                                            <Copy className="w-3.5 h-3.5 text-[#192837]/60 ml-2" />
                                        </>
                                    )}
                                </button>
                                <a
                                    href={REPO_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2.5 border border-[#192837]/10 bg-white hover:bg-[#192837]/5 rounded-xl transition-all hover:scale-[1.04] active:scale-[0.96] text-[#192837]"
                                    aria-label="View on GitHub"
                                >
                                    <Github className="w-5 h-5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[#192837]/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm opacity-60 font-medium">
                    <div>
                        © {new Date().getFullYear()} Elixpo · Built on Cloudflare's edge
                    </div>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:underline">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="hover:underline">
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
