import React from "react";
import { Box } from "@mui/material";

interface DashboardScrollLayoutProps {
    header: React.ReactNode;
    sidebar: React.ReactNode;
    content: React.ReactNode;
    scrollRef: React.RefObject<HTMLElement | null>;
}

export function DashboardScrollLayout({
    header,
    sidebar,
    content,
    scrollRef
}: DashboardScrollLayoutProps) {
    return (
        <Box
            sx={{
                // Ensure the layout takes the full height available (subtracting any top nav if necessary, but 100vh works for isolated viewport)
                // For layout with a global navbar, we assume `height: 'calc(100vh - VAR_NAV_HEIGHT)'` is handled by the parent
                // But for safety, let's use flex to fill available space
                display: "flex",
                flexDirection: "column",
                height: { md: "calc(100vh - 64px)" }, // Assuming 64px global nav. On mobile, we let it flow naturally
                overflow: { md: "hidden" }
            }}
        >
            {/* Header Area (Sticky/Fixed relative to this layout) */}
            <Box
                sx={{
                    flexShrink: 0,
                    zIndex: 10,
                    bgcolor: "var(--bg)",
                    pb: 2,
                    pt: 3,
                    borderBottom: "1px solid var(--border)",
                    mb: 3
                }}
            >
                {header}
            </Box>

            {/* Main Content Area */}
            <Box
                sx={{
                    display: "flex",
                    flex: 1,
                    minHeight: 0, // important for flex children to scroll
                    position: "relative"
                }}
            >
                {/* Scrollable Container (Desktop) / Natural Scroll (Mobile) */}
                <Box
                    ref={scrollRef}
                    sx={{
                        flex: 1,
                        overflowY: { md: "auto" },
                        overflowX: "hidden",
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        alignItems: "flex-start",
                        gap: 4,
                        pb: 10, // padding at bottom to ensure last section can be scrolled up
                    }}
                >
                    {/* Left Sidebar Nav */}
                    {sidebar}

                    {/* Editor / Content Pane */}
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0, // prevent flex blowout
                            width: "100%",
                        }}
                    >
                        {content}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
