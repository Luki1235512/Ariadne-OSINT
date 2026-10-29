import type { ObjectDetails, SourceSummary } from "@ariadne/shared";
import { ApiError } from "../api";
import { useObjectDetails } from "../queries";
import { flattenProperties, formatDate, safeUrl } from "./format";

interface ObjectPanelProps {
  selectedId: string | null;
}

export function ObjectPanel({ selectedId }: ObjectPanelProps) {
  const details = useObjectDetails(selectedId);

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
  return <ObjectView object={details.data} />;
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

function ObjectView({ object }: { object: ObjectDetails }) {
  const rows = flattenProperties(object.properties);
  const geometrySource = object.location?.source;
  const sources =
    geometrySource === undefined || object.sources.some((s) => s.id === geometrySource.id)
      ? object.sources
      : [...object.sources, geometrySource];

  return (
    <article className="object" aria-labelledby="object-title">
      <header className="object-header">
        <p className="object-type">{object.type}</p>
        <h2 id="object-title">{object.displayName}</h2>
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
