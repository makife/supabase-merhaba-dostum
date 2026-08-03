import Lottie from "lottie-react";
import mapPointAnim from "@/assets/mapPoint.json";

interface HomeMapPointProps {
  /** yatay konum, görsel genişliğinin yüzdesi */
  x: number;
  /** dikey konum, görsel yüksekliğinin yüzdesi */
  y: number;
  size?: number;
  label: string;
  onClick: () => void;
}

export const HomeMapPoint = ({ x, y, size = 46, label, onClick }: HomeMapPointProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="absolute z-20 active:scale-90 transition-transform duration-150"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      transform: "translate3d(-50%, -50%, 0)",
      WebkitTapHighlightColor: "transparent",
    }}
  >
    <Lottie
      animationData={mapPointAnim}
      loop
      autoplay
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    />
  </button>
);

export default HomeMapPoint;
