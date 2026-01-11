"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  variant?: "full" | "icon";
  className?: string;
  href?: string;
  showSubtitle?: boolean;
  subtitle?: string;
}

export function Logo({
  variant = "full",
  className = "",
  href,
  showSubtitle = false,
  subtitle = "Admin Panel",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={className}>
        {variant === "full" ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        )}
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  const logoContent =
    variant === "full" ? (
      <div className="flex flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isDark ? "/logo/logo-white.png" : "/logo/logo.png"}
          alt="ClientHappy"
          className="h-8 w-auto object-contain"
        />
        {showSubtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src="/logo/icon.png"
        alt="ClientHappy"
        className="h-8 w-8 object-contain"
      />
    );

  if (href) {
    return (
      <Link href={href} className={className}>
        {logoContent}
      </Link>
    );
  }

  return <div className={className}>{logoContent}</div>;
}
