import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import PrivateRoomCards from "@/components/PrivateRoomCards";

/**
 * Özel oda / rematch bekleme rotası.
 * Artık yeni PNG tabanlı "arkadaşını bekle" kartını (PrivateRoomCards) gösterir.
 */
const PrivateRoomWaitingPage = () => {
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const roomCode = paramCode || searchParams.get("code");
  const roomId = searchParams.get("roomId");
  const gameType = (searchParams.get("gameType") as "timed" | "score") || "timed";
  const botRematch = searchParams.get("botRematch") === "1";

  return (
    <PrivateRoomCards
      initialRoomId={roomId}
      initialRoomCode={roomCode}
      gameType={gameType}
      botRematch={botRematch}
      onClose={() => navigate("/", { replace: true })}
    />
  );
};

export default PrivateRoomWaitingPage;
