import type { ObjectDetails, SourceSummary } from "@ariadne/shared";
import { type RefObject, useEffect, useRef } from "react";
import { ApiError } from "../api";
import { useObjectDetails } from "../queries";
import { flattenProperties, formatDate, safeUrl } from "./format";
import { confidenceLabel, groupLinks } from "./links";

interface ObjectPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ObjectPanel({ selectedId, onSelect }: ObjectPanelProps) {
  const details = useObjectDetails(selectedId);
  const focusTitleRef = useRef(false);

  if (selectedId === null) {
    return <p className="panel-hint">Select an area on the map to see its details.</p>;
  }
  if (details.isPending) {
    return (
      <p className="panel-hint" role="status">
        Loading…
      </p>
    );
  }
  if (details.isError) {
    return (
      <p className="panel-error" role="alert">
        {errorMessage(details.error)}
      </p>
    );
  }
  return (
    <ObjectView
      object={details.data}
      focusTitleRef={focusTitleRef}
      onSelect={(id) => {
        focusTitleRef.current = true;
        onSelect(id);
      }}
    />
  );
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError && error.code === "NOT_FOUND") {
    return "This object does not exist, or it has been removed.";
  }
  if (error instanceof ApiError && error.code === "INVALID_REQUEST") {
    return "The address contains an invalid object ID.";
  }
  return "The details could not be loaded. Try again later.";
}

function ObjectView({
  object,
  focusTitleRef,
  onSelect,
}: {
  object: ObjectDetails;
  focusTitleRef: RefObject<boolean>;
  onSelect: (id: string) => void;
}) {
  const rows = flattenProperties(object.properties);
  const groups = groupLinks(object.links.items);

  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusTitleRef.current) {
      focusTitleRef.current = false;
      titleRef.current?.focus();
    }
  }, [object.id, focusTitleRef]);
  const geometrySource = object.location?.source;
  const sources =
    geometrySource === undefined || object.sources.some((s) => s.id === geometrySource.id)
      ? object.sources
      : [...object.sources, geometrySource];

  return (
    <article className="object" aria-labelledby="object-title">
      <header className="object-header">
        <p className="object-type">{object.type}</p>
        <h2 id="object-title" ref={titleRef} tabIndex={-1}>
          {object.displayName}
        </h2>
      </header>

      <section aria-labelledby="object-properties">
        <h3 id="object-properties">Properties</h3>
        <dl className="properties">
          {object.countryCode !== null && (
            <div>
              <dt>country</dt>
              <dd>{object.countryCode}</dd>
            </div>
          )}
          {rows.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="object-links">
        <h3 id="object-links">Links</h3>
        {groups.length === 0 ? (
          <p className="panel-hint">No links.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="link-group">
              <h4>{group.label}</h4>
              <ul className="links">
                {group.links.map((link) => {
                  const inferred = confidenceLabel(link.confidence);
                  return (
                    <li key={link.id}>
                      <button
                        type="button"
                        className="link-target"
                        onClick={() => {
                          onSelect(link.other.id);
                        }}
                      >
                        {link.other.displayName}
                      </button>
                      {inferred !== undefined && <span className="link-inferred">{inferred}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="source-meta">
                Source: {group.sources.map((source) => source.name).join("; ")}
              </p>
            </div>
          ))
        )}
        {object.links.total > object.links.items.length && (
          <p className="panel-hint">
            Showing {object.links.items.length} of {object.links.total} links.
          </p>
        )}
      </section>

      <section aria-labelledby="object-sources">
        <h3 id="object-sources">Sources</h3>
        <ul className="sources">
          {sources.map((source) => (
            <SourceItem key={source.id} source={source} />
          ))}
        </ul>
      </section>
    </article>
  );
}

function SourceItem({ source }: { source: SourceSummary }) {
  const url = safeUrl(source.url);
  const licenseUrl = safeUrl(source.licenseUrl);
  return (
    <li>
      <p className="source-name">
        {url === undefined ? (
          source.name
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {source.name}
          </a>
        )}
      </p>
      <p className="source-meta">{source.publisher}</p>
      <p className="source-meta">
        Licence:{" "}
        {licenseUrl === undefined ? (
          source.license
        ) : (
          <a href={licenseUrl} target="_blank" rel="noopener noreferrer">
            {source.license}
          </a>
        )}
      </p>
      <p className="source-meta">Retrieved {formatDate(source.retrievedAt)}</p>
    </li>
  );
}
