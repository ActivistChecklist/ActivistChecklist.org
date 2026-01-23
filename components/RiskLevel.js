import React from "react";
import { RichText } from "@/components/RichText";
import { storyblokEditable } from "@storyblok/react";
import { cn } from "@/lib/utils";
import styles from "../styles/RiskLevel.module.css";

const LEVEL_CONFIG = {
  everyone: {
    label: "everyone",
    bars: 1,
  },
  medium: {
    label: "medium risk",
    bars: 2,
  },
  high: {
    label: "high risk",
    bars: 3,
  },
};

function hasListOrMultipleBlocks(doc) {
  if (!doc?.content || !Array.isArray(doc.content)) return false;
  if (doc.content.length > 1) return true;
  const walk = (node) => {
    if (node.type === "bullet_list" || node.type === "ordered_list") return true;
    if (node.content?.length) return node.content.some(walk);
    return false;
  };
  return doc.content.some(walk);
}

function SignalBars({ filledCount, className }) {
  const heights = [4, 8, 12];
  return (
    <span className={cn("inline-flex items-end gap-0.5", className)} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-sm min-w-[4px] bg-current",
            i < filledCount ? "opacity-90" : "opacity-30"
          )}
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}

function RiskLevelBadge({ level }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.everyone;
  return (
    <span className={cn(styles.riskLevelBadge, styles.riskLevelBadgeInline)}>
      <SignalBars filledCount={config.bars} />
      {config.label}
    </span>
  );
}

const INTRO_LINE = "This section might be for you if:";

export function RiskLevel({ blok, level, body, className, ...props }) {
  const normalizedLevel = (level || "everyone").toLowerCase().replace(/-|\s/g, "_");
  const config = LEVEL_CONFIG[normalizedLevel] || LEVEL_CONFIG.everyone;
  const levelClass = styles[normalizedLevel] || styles.everyone;
  const isSingleLine = !hasListOrMultipleBlocks(body);

  return (
    <div
      className={cn(styles.riskLevel, levelClass, "prose", className)}
      {...storyblokEditable(blok)}
      {...props}
    >
      {isSingleLine ? (
        <div className={styles.riskLevelFloatWrap}>
          <span className={styles.riskLevelBadgeFloat}>
            <RiskLevelBadge level={normalizedLevel} />
          </span>
          <div className={cn(styles.riskLevelBody, styles.riskLevelBodyInline)}>
            <RichText document={body} />
          </div>
        </div>
      ) : (
        <>
          <div className={cn("flex flex-wrap items-baseline gap-2", styles.riskLevelFirstRow)}>
            <RiskLevelBadge level={normalizedLevel} />
            <strong className={styles.riskLevelIntro}>{INTRO_LINE}</strong>
          </div>
          <div className={styles.riskLevelBody}>
            <RichText document={body} />
          </div>
        </>
      )}
    </div>
  );
}
