"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { Button } from "./button";

const THINKING_WORDS = [
  "Thinking",
  "Processing",
  "Analyzing",
  "Computing",
  "Tinkering",
  "Pondering",
  "Crafting",
  "Generating",
];

function Spinner({ className }: { className?: string }) {
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    let frame: number;
    let lastTime = performance.now();
    let speed = 8;
    let targetSpeed = 8;
    let nextSpeedChange = performance.now() + Math.random() * 800 + 200;

    const animate = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      if (currentTime > nextSpeedChange) {
        targetSpeed = Math.random() * 15 + 3;
        nextSpeedChange = currentTime + Math.random() * 600 + 200;
      }

      speed += (targetSpeed - speed) * 0.05;
      setRotation((prev) => (prev + speed * (delta / 16)) % 360);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      className={cn("inline-block text-primary", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      ⁕
    </span>
  );
}

interface AILoaderProps {
  description?: string;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  variant?: "default" | "compact" | "inline";
}

function BitProgressBar() {
  const [bars, setBars] = React.useState<boolean[]>(Array(12).fill(false));

  React.useEffect(() => {
    const interval = setInterval(() => {
      setBars((prev) => {
        const next = [...prev];
        const emptyIndices = next
          .map((v, i) => (!v ? i : -1))
          .filter((i) => i !== -1);
        const filledIndices = next
          .map((v, i) => (v ? i : -1))
          .filter((i) => i !== -1);

        if (emptyIndices.length === 0) {
          return Array(12).fill(false);
        }

        if (Math.random() > 0.3 && emptyIndices.length > 0) {
          const randomEmpty =
            emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          next[randomEmpty] = true;
        }

        if (Math.random() > 0.7 && filledIndices.length > 0) {
          const randomFilled =
            filledIndices[Math.floor(Math.random() * filledIndices.length)];
          next[randomFilled] = false;
        }

        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-mono text-xs text-muted-foreground">
      [
      {bars.map((filled, i) => (
        <span
          key={i}
          className={filled ? "text-foreground" : "text-muted-foreground/30"}
        >
          {filled ? "█" : "░"}
        </span>
      ))}
      ]
    </span>
  );
}

function ThinkingText({ error }: { error?: string | null }) {
  const [wordIndex, setWordIndex] = React.useState(0);
  const [dots, setDots] = React.useState("");

  React.useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % THINKING_WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [error]);

  React.useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [error]);

  const text = error ? "Error" : THINKING_WORDS[wordIndex];

  return (
    <span className="inline-flex items-center gap-2">
      {/* {!error && <Spinner className="text-base" />} */}
      <motion.span
        key={text}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "uppercase font-departure text-sm",
          error ? "text-destructive" : "text-foreground"
        )}
      >
        {text}
      </motion.span>
    </span>
  );
}

export function AILoader({
  description,
  error,
  onRetry,
  className,
  variant = "default",
}: AILoaderProps) {
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 font-mono text-sm",
          className
        )}
      >
        <ThinkingText error={error} />
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-muted-foreground hover:text-foreground"
          >
            ↻
          </button>
        )}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col items-center gap-3 p-4", className)}>
        <div className="">
          <ThinkingText error={error} />
        </div>
        <BitProgressBar />
        {error && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-7 text-xs font-mono"
          >
            [retry]
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-6",
        className
      )}
    >
      <div className="">
        <ThinkingText error={error} />
      </div>

      <BitProgressBar />

      {description && !error && (
        <p className="text-xs text-muted-foreground font-mono max-w-xs text-center">
          {description}
        </p>
      )}

      {error && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-destructive/80 font-mono max-w-xs text-center">
            {error}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 text-xs font-mono gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function AILoaderInline({ className }: { className?: string }) {
  return <AILoader variant="inline" className={className} />;
}
