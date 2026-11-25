import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Adapted from ddoemonn's accessible 21st.dev Progress Bar.
export default function StudioProgress({ value, max, label }) {
  const labelId = useId();
  const reduced = useReducedMotion();
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return <div className="studio-progress"><div className="studio-progress-heading"><span id={labelId}>{label}</span><span>{value} / {max}</span></div><div role="progressbar" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="studio-progress-track"><motion.span initial={false} animate={{ scaleX: fraction }} transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 34, mass: 0.9 }} /></div></div>;
}
