import { useEffect, useState, type RefObject } from "react";

export function useScrollSpy(
    sectionIds: string[],
    containerRef: RefObject<HTMLElement | null>,
    offset: number = 100 // offset for intersection root margin
) {
    const [activeId, setActiveId] = useState<string>(sectionIds[0] || "");

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Keep track of which sections are currently intersecting
        const intersectingRatios = new Map<string, number>();
        let currentActiveId = activeId;

        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                intersectingRatios.set(entry.target.id, entry.intersectionRatio);
            });

            // Find the visible section with the highest intersection ratio
            let maxRatio = 0;
            
            sectionIds.forEach((id) => {
                const ratio = intersectingRatios.get(id) || 0;
                if (ratio > maxRatio) {
                    maxRatio = ratio;
                    currentActiveId = id;
                }
            });

            // Fallback for fast scrolling
            if (maxRatio === 0) {
                let closestId = currentActiveId;
                let minDistance = Infinity;
                const containerRect = container.getBoundingClientRect();
                const viewCenter = containerRect.top + containerRect.height / 3;

                sectionIds.forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        const distance = Math.abs(rect.top - viewCenter);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestId = id;
                        }
                    }
                });
                if (closestId && minDistance !== Infinity) {
                    currentActiveId = closestId;
                }
            }

            if (currentActiveId && currentActiveId !== activeId) {
                setActiveId(currentActiveId);
            }
        };

        const observer = new IntersectionObserver(handleIntersect, {
            root: container,
            rootMargin: `-${offset}px 0px 0px 0px`,
            threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], // Granular thresholds
        });

        // Initialize by observing all sections
        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                observer.observe(el);
            }
        });

        // Cleanup
        return () => observer.disconnect();
    }, [sectionIds, containerRef, offset, activeId]);

    return activeId;
}
