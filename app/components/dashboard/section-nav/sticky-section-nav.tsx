import React, { type RefObject } from "react";
import { Box, Typography } from "@mui/material";

export interface NavSection {
    id: string;
    label: string;
}

interface StickySectionNavProps {
    sections: NavSection[];
    activeSectionId: string;
    scrollContainerRef: RefObject<HTMLElement | null>;
    offset?: number; // How much padding to leave at top when scrolling
}

export function StickySectionNav({
    sections,
    activeSectionId,
    scrollContainerRef,
    offset = 120, // default offset to account for sticky header
}: StickySectionNavProps) {
    const handleNavClick = (id: string) => {
        const container = scrollContainerRef.current;
        const target = document.getElementById(id);

        if (container && target) {
            // Calculate relative offset
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            
            // Current scroll + target position relative to container - header offset
            const scrollPos = container.scrollTop + (targetRect.top - containerRect.top) - offset;
            
            container.scrollTo({
                top: scrollPos,
                behavior: "smooth"
            });
        }
    };

    return (
        <>
            {/* Desktop Nav (Vertical sidebar) */}
            <Box
                sx={{
                    display: { xs: "none", md: "block" },
                    position: "sticky",
                    top: 24, // spacing from top of scroll container
                    width: 240,
                    flexShrink: 0,
                }}
            >
                <Box
                    component="nav"
                    aria-label="Section Navigation"
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        pl: 0,
                        borderLeft: "2px solid var(--border)",
                    }}
                >
                    {sections.map((sec) => {
                        const isActive = activeSectionId === sec.id;
                        return (
                            <Box
                                key={sec.id}
                                component="button"
                                aria-current={isActive ? "true" : undefined}
                                onClick={() => handleNavClick(sec.id)}
                                sx={{
                                    textAlign: "left",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    py: 1,
                                    pl: 2,
                                    ml: "-2px", // overlap the border
                                    borderLeft: `2px solid ${isActive ? "#ff7759" : "transparent"}`,
                                    color: isActive ? "var(--fg)" : "var(--fg-faint)",
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: "0.95rem",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        color: "var(--fg)",
                                        bgcolor: "rgba(255, 119, 89, 0.05)",
                                    },
                                }}
                            >
                                {sec.label}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* Mobile Nav (Horizontal pill bar) */}
            <Box
                sx={{
                    display: { xs: "flex", md: "none" },
                    overflowX: "auto",
                    gap: 1,
                    mb: 3,
                    pb: 1,
                    "&::-webkit-scrollbar": { height: "4px" },
                    "&::-webkit-scrollbar-thumb": {
                        background: "var(--border)",
                        borderRadius: "4px",
                    },
                }}
            >
                {sections.map((sec) => {
                    const isActive = activeSectionId === sec.id;
                    return (
                        <Box
                            key={sec.id}
                            component="button"
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => handleNavClick(sec.id)}
                            sx={{
                                background: isActive ? "rgba(255, 119, 89, 0.15)" : "var(--surface)",
                                border: `1px solid ${isActive ? "rgba(255, 119, 89, 0.5)" : "var(--border)"}`,
                                color: isActive ? "#ff7759" : "var(--fg-faint)",
                                borderRadius: "20px",
                                px: 2,
                                py: 0.75,
                                fontSize: "0.9rem",
                                fontWeight: isActive ? 600 : 500,
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                                "&:hover": {
                                    borderColor: isActive ? "rgba(255, 119, 89, 0.8)" : "var(--fg-muted)",
                                    color: isActive ? "#ff7759" : "var(--fg)",
                                },
                            }}
                        >
                            {sec.label}
                        </Box>
                    );
                })}
            </Box>
        </>
    );
}
