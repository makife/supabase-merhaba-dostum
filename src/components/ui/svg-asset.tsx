import type { CSSProperties } from "react";

interface SvgAssetProps {
  src: string;
  alt?: string;
  className?: string;
  backgroundSize?: CSSProperties["backgroundSize"];
}

export function SvgAsset({
  src,
  alt,
  className = "",
  backgroundSize = "contain",
}: SvgAssetProps) {
  const style: CSSProperties = {
    backgroundImage: `url("${src}")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize,
    transform: "translateZ(0)",
    WebkitTransform: "translateZ(0)",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    willChange: "transform",
  };

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`block shrink-0 ${className}`.trim()}
      style={style}
    />
  );
}