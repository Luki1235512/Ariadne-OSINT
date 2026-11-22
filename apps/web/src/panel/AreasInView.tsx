import type { AreaInView } from "../map/inView";
import "./panel.css";

const MAX_SHOWN = 200;

interface AreasInViewProps {
  areas: AreaInView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AreasInView({ areas, selectedId, onSelect }: AreasInViewProps) {
  const shown = areas.slice(0, MAX_SHOWN);
  return (
    <section className="in-view" aria-labelledby="in-view-title">
      <h2 id="in-view-title">
        In view <span className="in-view-count">({areas.length})</span>
      </h2>
      {areas.length === 0 ? (
        <p className="panel-hint">Nothing in view. Move or zoom the map.</p>
      ) : (
        <ul className="in-view-list">
          {shown.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                className="link-target"
                aria-current={area.id === selectedId ? "true" : undefined}
                onClick={() => {
                  onSelect(area.id);
                }}
              >
                {area.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {areas.length > MAX_SHOWN && (
        <p className="panel-hint">
          Showing the first {MAX_SHOWN} of {areas.length}. Zoom in to see the rest.
        </p>
      )}
    </section>
  );
}
