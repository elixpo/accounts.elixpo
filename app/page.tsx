"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BoltIcon from "@mui/icons-material/Bolt";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import HubIcon from "@mui/icons-material/Hub";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import Link from "next/link";
import Navbar from "./components/navbar";

const ACCENT = "#9b7bf7";

const FEATURES = [
    {
        icon: HubIcon,
        title: "One account, everywhere",
        body: "Sign in once and reach every Elixpo product — chat, art, blogs, clock, jackey, sketch — without juggling passwords.",
    },
    {
        icon: FingerprintIcon,
        title: "Passkey + WebAuthn",
        body: "Phishing-resistant, passwordless login the moment your device supports it. Falls back gracefully to email and OAuth.",
    },
    {
        icon: LockOutlinedIcon,
        title: "OAuth 2.0 for integrators",
        body: "A first-class Authorization Code flow with PKCE. Bring Elixpo identity to your own app in minutes.",
    },
    {
        icon: BoltIcon,
        title: "Edge-native, instant",
        body: "Runs on Cloudflare's edge — sign-in checks complete in milliseconds, anywhere on the planet.",
    },
];

export default function LandingPage() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                background:
                    "linear-gradient(180deg, #0f1117 0%, #131922 50%, #0f1117 100%)",
                color: "#f5f5f4",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Navbar />

            <Box
                component="main"
                sx={{
                    flex: 1,
                    maxWidth: "1200px",
                    width: "100%",
                    mx: "auto",
                    px: { xs: 2.5, md: 4 },
                    pt: { xs: 8, md: 14 },
                    pb: { xs: 8, md: 12 },
                }}
            >
                {/* Hero */}
                <Stack
                    spacing={3}
                    alignItems="center"
                    textAlign="center"
                    sx={{ maxWidth: "820px", mx: "auto" }}
                >
                    <Chip
                        label="The Elixpo identity layer"
                        size="small"
                        sx={{
                            bgcolor: "rgba(155, 123, 247, 0.12)",
                            color: ACCENT,
                            border: "1px solid rgba(155, 123, 247, 0.3)",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            fontSize: "0.72rem",
                            height: 26,
                        }}
                    />
                    <Typography
                        component="h1"
                        sx={{
                            fontWeight: 800,
                            fontSize: { xs: "2.4rem", md: "3.6rem" },
                            lineHeight: 1.08,
                            letterSpacing: "-0.025em",
                            background:
                                "linear-gradient(180deg, #ffffff 0%, #c8c4d8 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        One sign-in for the whole{" "}
                        <Box component="span" sx={{ color: ACCENT }}>
                            Elixpo ecosystem.
                        </Box>
                    </Typography>
                    <Typography
                        sx={{
                            color: "rgba(255,255,255,0.65)",
                            fontSize: { xs: "1rem", md: "1.15rem" },
                            maxWidth: "640px",
                            lineHeight: 1.55,
                        }}
                    >
                        Secure OAuth 2.0 single sign-on built on the edge. Use
                        one account across every Elixpo product, and let your
                        own apps tap into the same identity in minutes.
                    </Typography>

                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        sx={{ pt: 1 }}
                    >
                        <Button
                            component={Link}
                            href="/login"
                            endIcon={<ArrowForwardIcon />}
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: "1rem",
                                color: "#fff",
                                background:
                                    "linear-gradient(135deg, #9b7bf7 0%, #7c5cff 100%)",
                                borderRadius: "12px",
                                px: 3,
                                py: 1.3,
                                boxShadow: "0 8px 24px rgba(155,123,247,0.35)",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background:
                                        "linear-gradient(135deg, #b094ff 0%, #8a6dff 100%)",
                                    boxShadow:
                                        "0 12px 32px rgba(155,123,247,0.5)",
                                    transform: "translateY(-1px)",
                                },
                            }}
                        >
                            Get started
                        </Button>
                        <Button
                            component={Link}
                            href="/docs"
                            sx={{
                                textTransform: "none",
                                fontWeight: 500,
                                fontSize: "1rem",
                                color: "rgba(255,255,255,0.85)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: "12px",
                                px: 3,
                                py: 1.3,
                                "&:hover": {
                                    borderColor: "rgba(155,123,247,0.4)",
                                    background: "rgba(255,255,255,0.04)",
                                },
                            }}
                        >
                            Integrator docs
                        </Button>
                    </Stack>
                </Stack>

                {/* Features */}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "1fr 1fr",
                        },
                        gap: 2.5,
                        mt: { xs: 8, md: 12 },
                    }}
                >
                    {FEATURES.map(({ icon: Icon, title, body }) => (
                        <Box
                            key={title}
                            sx={{
                                p: 3,
                                borderRadius: "16px",
                                background:
                                    "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                backdropFilter: "blur(20px)",
                                transition: "border-color 0.2s ease",
                                "&:hover": {
                                    borderColor: "rgba(155,123,247,0.3)",
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    p: 1.1,
                                    borderRadius: "10px",
                                    background: "rgba(155,123,247,0.12)",
                                    border: "1px solid rgba(155,123,247,0.25)",
                                    mb: 2,
                                }}
                            >
                                <Icon sx={{ color: ACCENT, fontSize: 22 }} />
                            </Box>
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: "1.05rem",
                                    color: "#f5f5f4",
                                    mb: 0.8,
                                }}
                            >
                                {title}
                            </Typography>
                            <Typography
                                sx={{
                                    color: "rgba(255,255,255,0.6)",
                                    fontSize: "0.92rem",
                                    lineHeight: 1.55,
                                }}
                            >
                                {body}
                            </Typography>
                        </Box>
                    ))}
                </Box>

                {/* CTA */}
                <Box
                    sx={{
                        mt: { xs: 8, md: 12 },
                        p: { xs: 4, md: 5 },
                        borderRadius: "20px",
                        background:
                            "linear-gradient(135deg, rgba(155,123,247,0.12) 0%, rgba(124,92,255,0.05) 100%)",
                        border: "1px solid rgba(155,123,247,0.25)",
                        textAlign: "center",
                    }}
                >
                    <Typography
                        sx={{
                            fontWeight: 700,
                            fontSize: { xs: "1.5rem", md: "1.9rem" },
                            color: "#f5f5f4",
                            mb: 1.2,
                            letterSpacing: "-0.015em",
                        }}
                    >
                        Ready when you are.
                    </Typography>
                    <Typography
                        sx={{
                            color: "rgba(255,255,255,0.65)",
                            fontSize: "1rem",
                            mb: 3,
                            maxWidth: "520px",
                            mx: "auto",
                        }}
                    >
                        Create an account in seconds, or sign in if you already
                        have one. Your identity carries across every Elixpo
                        product automatically.
                    </Typography>
                    <Button
                        component={Link}
                        href="/login"
                        endIcon={<ArrowForwardIcon />}
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "1rem",
                            color: "#fff",
                            background:
                                "linear-gradient(135deg, #9b7bf7 0%, #7c5cff 100%)",
                            borderRadius: "12px",
                            px: 3.2,
                            py: 1.3,
                            boxShadow: "0 8px 24px rgba(155,123,247,0.35)",
                            "&:hover": {
                                background:
                                    "linear-gradient(135deg, #b094ff 0%, #8a6dff 100%)",
                                boxShadow: "0 12px 32px rgba(155,123,247,0.5)",
                                transform: "translateY(-1px)",
                            },
                        }}
                    >
                        Continue to sign in
                    </Button>
                </Box>
            </Box>

            {/* Footer */}
            <Box
                component="footer"
                sx={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    py: 3,
                    px: { xs: 2.5, md: 4 },
                    color: "rgba(255,255,255,0.45)",
                    fontSize: "0.85rem",
                    textAlign: "center",
                }}
            >
                © {new Date().getFullYear()} Elixpo · Built on Cloudflare's edge
                ·{" "}
                <Link href="/about" style={{ color: "rgba(255,255,255,0.7)" }}>
                    About
                </Link>
            </Box>
        </Box>
    );
}
