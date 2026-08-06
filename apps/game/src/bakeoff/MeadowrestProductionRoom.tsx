import { useEffect, useState } from "react";
import type { ProductionRoomProfile } from "./productionRoomTypes";
import { ProductionRoomLandscape } from "./ProductionRoomLandscape";

export function MeadowrestProductionRoom() {
  const [profile, setProfile] = useState<ProductionRoomProfile>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const profileParam = params.get("profile");
      if (profileParam === "quality" || profileParam === "balanced") {
        return profileParam;
      }
    }
    return "balanced";
  });

  const [isPortraitMode, setIsPortraitMode] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

  useEffect(() => {
    const isPortrait = () => {
      if (typeof window !== "undefined") {
        return window.innerHeight > window.innerWidth;
      }
      return false;
    };

    const handleResize = () => {
      setIsPortraitMode(isPortrait());
    };

    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleProfileChange = (newProfile: ProductionRoomProfile) => {
    setProfile(newProfile);
  };

  if (isPortraitMode) {
    return (
      <div
        data-everloom-authoritative-app="apps-game"
        data-everloom-bakeoff="meadowrest"
        className="production-room-portrait"
      >
        <div className="portrait-overlay">
          <h2>Rotate to landscape</h2>
          <p>The production room is measured in a wider view.</p>
        </div>
      </div>
    );
  }

  return <ProductionRoomLandscape profile={profile} onProfileChange={handleProfileChange} />;
}
