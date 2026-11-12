import { QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { createQueryClient, useObjectDetails } from "./data/queries";
import { toFocusTarget } from "./map/camera";
import { sameAreas, type AreaInView } from "./map/inView";
import { MapView } from "./map/MapView";
import { AreasInView } from "./panel/AreasInView";
import { ObjectPanel } from "./panel/ObjectPanel";
import { SearchBox } from "./search/SearchBox";
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

  const [areas, setAreas] = useState<AreaInView[]>([]);
  const updateAreas = useCallback((next: AreaInView[]) => {
    setAreas((current) => (sameAreas(current, next) ? current : next));
  }, []);

  const focusTitleRef = useRef(false);
  const selectFromPanel = (id: string, moveMap: boolean) => {
    if (id !== selectedId) {
      focusTitleRef.current = true;
      select(id, moveMap);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Ariadne</h1>
        <SearchBox
          onSelect={(id) => {
            select(id, true);
          }}
        />
      </header>
      <div className="body">
        <main className="map-area">
          <MapView
            selectedId={selectedId}
            onSelect={(id) => {
              select(id);
            }}
            focus={focus}
            onAreasInView={updateAreas}
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
              focusTitleRef={focusTitleRef}
              onSelect={(id) => {
                selectFromPanel(id, true);
              }}
            />
            <AreasInView
              areas={areas}
              selectedId={selectedId}
              onSelect={(id) => {
                selectFromPanel(id, false);
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
