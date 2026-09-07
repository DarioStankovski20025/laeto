"use client";

import { motion } from "motion/react";
import { TrendingUp, ShieldCheck, LineChart } from "lucide-react";

const points = [
  { icon: ShieldCheck, label: "Private, single-tenant dashboard" },
  { icon: LineChart, label: "Daily competitor price monitoring" },
  { icon: TrendingUp, label: "One click to check any product now" },
];

/** Animated visual panel shown alongside auth forms on large screens. */
export function AuthVisualPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="text-lg font-semibold tracking-tight">LAETO LTD</span>
      </motion.div>

      <div className="flex flex-col gap-6">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="max-w-md text-3xl font-semibold leading-tight tracking-tight"
        >
          Stay ahead of every Amazon competitor, automatically.
        </motion.h2>

        <ul className="flex flex-col gap-3">
          {points.map((point, index) => (
            <motion.li
              key={point.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + index * 0.08, ease: "easeOut" }}
              className="flex items-center gap-3 text-sm text-primary-foreground/90"
            >
              <point.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {point.label}
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="text-xs text-primary-foreground/60"
      >
        Private access only. Contact your administrator for an account.
      </motion.p>

      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
    </div>
  );
}
