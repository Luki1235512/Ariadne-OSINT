import { useState } from "react";
import { MapView } from "./map/MapView";

export function App() {
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="app">
      <header className="header">
        <h1>Ariadne</h1>
      </header>
      <div className="body">
        <main className="map-area">
          <MapView />
        </main>
        <aside
          id="side-panel"
          className={panelOpen ? "panel" : "panel panel--closed"}
          aria-label="Panel boczny"
          inert={!panelOpen}
        >
          <div className="panel-content" />
        </aside>
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