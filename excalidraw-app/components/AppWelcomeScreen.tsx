import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

// lili.math: branded welcome screen for the lesson board
const MASCOTS = ["cat", "capy", "rac", "meer", "lab", "ham"];

const BrandMark = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 64 64"
    role="img"
    aria-label="25/25"
    style={{ flex: "none" }}
  >
    <defs>
      <linearGradient id="lili-logo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1747c9" />
        <stop offset=".55" stopColor="#1f53d8" />
        <stop offset="1" stopColor="#2f6be8" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="19" fill="url(#lili-logo-grad)" />
    <text
      x="32"
      y="27"
      textAnchor="middle"
      fontFamily="-apple-system,BlinkMacSystemFont,SF Pro Display,Inter,system-ui,sans-serif"
      fontWeight="800"
      fontSize="18"
      fill="#f3ece2"
    >
      25
    </text>
    <rect x="15" y="32" width="34" height="3.4" rx="1.7" fill="#f2905e" />
    <text
      x="32"
      y="53"
      textAnchor="middle"
      fontFamily="-apple-system,BlinkMacSystemFont,SF Pro Display,Inter,system-ui,sans-serif"
      fontWeight="800"
      fontSize="18"
      fill="#f3ece2"
    >
      25
    </text>
  </svg>
);

export const AppWelcomeScreen: React.FC<{
  onCollabDialogOpen: () => any;
  isCollabEnabled: boolean;
}> = React.memo((props) => {
  const { t } = useI18n();
  const base = import.meta.env.BASE_URL || "/";

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo>
          <div className="lili-brand">
            <BrandMark />
            <div className="lili-brand__text">
              <div className="lili-brand__name">lili.math</div>
              <div className="lili-brand__sub">доска для занятий</div>
            </div>
          </div>
        </WelcomeScreen.Center.Logo>
        <div className="lili-mascots" aria-hidden="true">
          {MASCOTS.map((m, i) => (
            <img
              key={m}
              src={`${base}mascots/${m}.jpg`}
              alt=""
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        <WelcomeScreen.Center.Heading>
          Рисунки сохраняются в этом браузере.
          <br />
          Важное сохраняй в файл через меню.
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          <WelcomeScreen.Center.MenuItemLoadScene />
          {props.isCollabEnabled && (
            <WelcomeScreen.Center.MenuItemLiveCollaborationTrigger
              onSelect={() => props.onCollabDialogOpen()}
            />
          )}
          <WelcomeScreen.Center.MenuItemHelp />
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
