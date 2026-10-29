import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toFocusTarget } from "./map/camera";
import { MapView } from "./map/MapView";
import { ObjectPanel } from "./panel/ObjectPanel";
import { createQueryClient, useObjectDetails } from "./queries";
import { useSelection } from "./selection";

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  );
}

function Layout() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [selection, select] = useSelection();
  const selectedId = selection.id;

  const details = useObjectDetails(selectedId);
  const focus =
    selection.focus && details.data?.id === selectedId ? toFocusTarget(details.data) : null;

  return (
    <div className="app">
      <header className="header">
        <h1>Ariadne</h1>
      </header>
      <div className="body">
        <main className="map-area">
          <MapView
            selectedId={selectedId}
            onSelect={(id) => {
              select(id);
            }}
            focus={focus}
          />
        </main>
        <aside
          id="side-panel"
          className={panelOpen ? "panel" : "panel panel--closed"}
          aria-label="Side panel"
          inert={!panelOpen}
        >
          <div className="panel-content">
            <ObjectPanel
              selectedId={selectedId}
              onSelect={(id) => {
                select(id, true);
              }}
            />
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
  );
}
