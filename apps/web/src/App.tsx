import { useEffect } from "react";
import { useGameStore } from "./store/gameStore";
import { Landing } from "./components/Landing";
import { CharacterCreate } from "./components/CharacterCreate";
import { CharacterSelect } from "./components/CharacterSelect";
import { GameScreen } from "./components/GameScreen";
import { ReturnReport } from "./components/ReturnReport";
import "./styles/globals.css";

export function App() {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    const setOnline  = () => useGameStore.setState({ isOffline: false });
    const setOffline = () => useGameStore.setState({ isOffline: true });
    window.addEventListener("online",  setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online",  setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {screen === "landing"          && <Landing />}
      {screen === "character_select" && <CharacterSelect />}
      {screen === "create"           && <CharacterCreate />}
      {screen === "game"             && <GameScreen />}
      {screen === "return_report"    && (
        <>
          <GameScreen />
          <ReturnReport />
        </>
      )}
    </div>
  );
}
