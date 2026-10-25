import { useState } from "react";
import { MapView } from "./map/MapView";

export function App() {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="app">
      <header className="header">
        <h1>Ariadne</h1>
      </header>
      <div className={panelOpen ? "body" : "body body--panel-closed"}>
        <main className="map-area">
          <MapView />
        </main>
        <aside id="side-panel" className="panel" aria-label="Panel boczny" hidden={!panelOpen} />
      </div>
      <button
        type="button"
        className="panel-toggle"
        aria-controls="side-panel"
        aria-expanded={panelOpen}
        aria-label={panelOpen ? "Zwiń panel boczny" : "Rozwiń panel boczny"}
        onClick={() => {
          setPanelOpen((open) => !open);
        }}
      />
    </div>
  );
}
