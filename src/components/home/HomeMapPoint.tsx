import Lottie from "lottie-react";
import mapPointAnim from "@/assets/mapPoint.json";
import mapPointAlertAnim from "@/assets/mapPoint1.json";

interface HomeMapPointProps {
  /** yatay konum, görsel genişliğinin yüzdesi */
  x: number;
  /** dikey konum, görsel yüksekliğinin yüzdesi */
  y: number;
  size?: number;
  label: string;
  /** bildirim varsa mapPoint1 animasyonu oynar */
  alert?: boolean;
  onClick: () => void;
}

export const HomeMapPoint = ({ x, y, size = 46, label, alert = false, onClick }: HomeMapPointProps) => (
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
      key={alert ? "alert" : "idle"}
      animationData={alert ? mapPointAlertAnim : mapPointAnim}
      loop
      autoplay
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    />
  </button>
);

export default HomeMapPoint;
