"use client";

import type { DragEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type FileDropSurfaceProps = {
  children: ReactNode;
  onFilesDrop?: (files: File[]) => void | Promise<void>;
};

function supportsDesktopDropTarget() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 768px) and (pointer: fine)").matches
  );
}

function isFileDrag(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function dragStartedOnInPageImage(event: globalThis.DragEvent) {
  return event.composedPath().some((node) => node instanceof HTMLImageElement);
}

export function FileDropSurface({
  children,
  onFilesDrop,
}: FileDropSurfaceProps) {
  const dragDepthRef = useRef(0);
  const internalPageImageDragRef = useRef(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    function onDragStart(event: globalThis.DragEvent) {
      if (dragStartedOnInPageImage(event)) {
        internalPageImageDragRef.current = true;
      }
    }

    function onDragEnd() {
      internalPageImageDragRef.current = false;
    }

    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("dragend", onDragEnd, true);
    return () => {
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("dragend", onDragEnd, true);
    };
  }, []);

  function resetDropTarget() {
    dragDepthRef.current = 0;
    setIsActive(false);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    if (
      !onFilesDrop ||
      !supportsDesktopDropTarget() ||
      !isFileDrag(event) ||
      internalPageImageDragRef.current
    ) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (
      !onFilesDrop ||
      !supportsDesktopDropTarget() ||
      !isFileDrag(event) ||
      internalPageImageDragRef.current
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (
      !onFilesDrop ||
      !supportsDesktopDropTarget() ||
      !isFileDrag(event) ||
      internalPageImageDragRef.current
    ) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onFilesDrop || !supportsDesktopDropTarget() || !isFileDrag(event)) {
      return;
    }

    event.preventDefault();
    const fromInPageImage = internalPageImageDragRef.current;
    internalPageImageDragRef.current = false;
    resetDropTarget();

    if (fromInPageImage) {
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);

    if (files.length === 0) {
      return;
    }

    void onFilesDrop(files);
  }

  return (
    <section
      aria-label="File upload drop zone"
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isActive ? (
        <div className="pointer-events-none absolute inset-0 z-50 hidden items-center justify-center bg-ink/35 px-6 backdrop-blur-[1px] md:flex">
          <div className="w-full max-w-xl rounded-card border-2 border-dashed border-accent bg-surface/95 px-8 py-14 text-center shadow-raise backdrop-blur">
            <p className="font-display text-3xl font-medium tracking-tight text-ink">
              Drop files here
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Uploads are copied into ingest/ and processed automatically.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
