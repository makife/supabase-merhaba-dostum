import { useEffect } from "react";
import cancelCard from "@/assets/aramaIptalEdildiKart.webp";

interface SearchCancelledCardProps {
  open: boolean;
  onClose: () => void;
  duration?: number;
}

const SearchCancelledCard = ({ open, onClose, duration = 2200 }: SearchCancelledCardProps) => {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, onClose, duration]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 px-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <img
        src={cancelCard}
        alt="Arama iptal edildi"
        className="w-full max-w-[380px] select-none animate-in zoom-in-95 duration-300 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
    </div>
  );
};

export default SearchCancelledCard;
