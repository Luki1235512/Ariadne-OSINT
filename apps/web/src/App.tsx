import { useState } from "react";
import { MapView } from "./map/MapView";
import { useSelection } from "./selection";
import { QueryClientProvider } from "@tanstack/react-query";
import { ObjectPanel } from "./panel/ObjectPanel";
import { createQueryClient } from "./queries";

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedId, select] = useSelection();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="header">
          <h1>Ariadne</h1>
        </header>
        <div className="body">
          <main className="map-area">
            <MapView selectedId={selectedId} onSelect={select} />
          </main>
          <aside
            id="side-panel"
            className={panelOpen ? "panel" : "panel panel--closed"}
            aria-label="Side panel"
            inert={!panelOpen}
          >
            <div className="panel-content">
              <ObjectPanel selectedId={selectedId} />
            </div>
          </aside>
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-controls="side-panel"
          aria-expanded={panelOpen}
          aria-label={panelOpen ? "Collapse side panel" : "Expand side panel"}
          onClick={() => {
            setPanelOpen((open) => !open);
          }}
        />
      </div>
    </QueryClientProvider>
  );
}
