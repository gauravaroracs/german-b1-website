import React from "react";

// Adapted from wensity's 21st.dev Card primitive for the Learning Studio palette.
export default function StudioCard({ as: Element = "div", className = "", children, ...props }) {
  return <Element data-wensity-primitive="" className={`studio-card ${className}`} {...props}>{children}</Element>;
}
