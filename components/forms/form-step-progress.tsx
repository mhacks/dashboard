"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";

type FormStepProgressStep = {
  label: string;
  shortLabel?: string;
};

const MOSS = "var(--color-moss)";
const MOSS_15 = "color-mix(in srgb, var(--color-moss) 15%, transparent)";
const MOSS_20 = "color-mix(in srgb, var(--color-moss) 20%, transparent)";
const MOSS_25 = "color-mix(in srgb, var(--color-moss) 25%, transparent)";
const MOSS_30 = "color-mix(in srgb, var(--color-moss) 30%, transparent)";
const MOSS_65 = "color-mix(in srgb, var(--color-moss) 65%, transparent)";

export function FormStepProgress({
  current,
  steps,
  label = "Form progress",
  itemClassName = "w-14",
}: {
  current: number;
  steps: readonly FormStepProgressStep[];
  label?: string;
  itemClassName?: string;
}) {
  return (
    <div className="flex w-full items-start" aria-label={label}>
      {steps.map((step, index) => {
        const isActive = index === current;
        const isDone = index < current;
        const visibleLabel = step.shortLabel ?? step.label;
        return (
          <Fragment key={`${step.label}-${index}`}>
            <div className="flex shrink-0 flex-col items-center">
              <motion.div
                animate={isActive ? { scale: 1.3 } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className="rounded-full"
                style={
                  isActive
                    ? {
                        width: 10,
                        height: 10,
                        background: MOSS,
                        boxShadow: `0 0 0 3px ${MOSS_20}`,
                      }
                    : isDone
                      ? { width: 8, height: 8, background: MOSS }
                      : {
                          width: 8,
                          height: 8,
                          background: MOSS_15,
                          border: `1.5px solid ${MOSS_25}`,
                        }
                }
              />
              <span
                className={`mt-2 text-center font-red-hat text-[10px] leading-tight tracking-wide transition-all duration-300 ${itemClassName}`}
                style={{
                  color: isActive ? MOSS : isDone ? MOSS_65 : MOSS_30,
                  fontWeight: isActive ? 700 : isDone ? 600 : 400,
                }}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓ " : ""}
                {visibleLabel}
              </span>
            </div>
            {index < steps.length - 1 && (
              <motion.div
                className="mx-1 mt-[4px] h-px flex-1"
                animate={{
                  backgroundColor: isDone ? MOSS : MOSS_15,
                }}
                transition={{ duration: 0.4 }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
