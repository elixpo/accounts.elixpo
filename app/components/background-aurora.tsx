"use client";

import { Box } from "@mui/material";

type Variant = "default" | "auth" | "warm" | "docs";

const PALETTES: Record<Variant, [string, string, string]> = {
    default: ["#7342E2", "#7342E2", "#7342E2"],
    auth: ["#7342E2", "#7342E2", "#7342E2"],
    warm: ["#7342E2", "#7342E2", "#7342E2"],
    docs: ["#7342E2", "#7342E2", "#7342E2"],
};

interface Props {
    variant?: Variant;
}

const BackgroundAurora = ({ variant = "default" }: Props) => {
    const [a, b, c] = PALETTES[variant];

    return (
        <Box
            aria-hidden
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
                overflow: "hidden",
                background:
                    "linear-gradient(180deg, #F2F2EE 0%, #F2F2EE 50%, #F2F2EE 100%)",
                "&::before, &::after": {
                    content: '""',
                    position: "absolute",
                    width: "55vmax",
                    height: "55vmax",
                    borderRadius: "50%",
                    filter: "blur(110px)",
                    opacity: 0.1,
                    willChange: "transform",
                },
                "&::before": {
                    top: "-20vmax",
                    left: "-15vmax",
                    background: `radial-gradient(circle, ${a} 0%, transparent 65%)`,
                    animation: "auroraDriftA 28s ease-in-out infinite",
                },
                "&::after": {
                    bottom: "-25vmax",
                    right: "-20vmax",
                    background: `radial-gradient(circle, ${b} 0%, transparent 65%)`,
                    animation: "auroraDriftB 34s ease-in-out infinite",
                },
            }}
        >
            <Box
                aria-hidden
                sx={{
                    position: "absolute",
                    top: "40%",
                    left: "55%",
                    width: "40vmax",
                    height: "40vmax",
                    borderRadius: "50%",
                    filter: "blur(120px)",
                    opacity: 0.07,
                    background: `radial-gradient(circle, ${c} 0%, transparent 65%)`,
                    animation: "auroraDriftC 40s ease-in-out infinite",
                    willChange: "transform",
                }}
            />
        </Box>
    );
};

export default BackgroundAurora;
