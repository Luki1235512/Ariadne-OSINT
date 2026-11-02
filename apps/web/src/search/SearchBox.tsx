import { useId, useState } from "react";
import type { SearchResult } from "@ariadne/shared";
import { MIN_SEARCH_LENGTH, useSearch } from "../queries";
import { moveActive } from "./keyboard";
import { useDebouncedValue } from "./useDebouncedValue";

interface SearchBoxProps {
  onSelect: (id: string) => void;
}

export function SearchBox({ onSelect }: SearchBoxProps) {
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = useDebouncedValue(text, 200);
  const search = useSearch(query);

  const results = search.data?.results ?? [];
  const ready = query.trim().length >= MIN_SEARCH_LENGTH;
  const showList = open && ready && search.data !== undefined;
  const activeResult = showList ? results[active] : undefined;

  const choose = (result: SearchResult) => {
    setText(result.displayName);
    setOpen(false);
    setActive(-1);
    onSelect(result.id);
  };

  return (
    <div className="search">
      <input
        type="search"
        className="search-input"
        placeholder="Search places…"
        aria-label="Search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={
          activeResult === undefined ? undefined : `${listId}-${String(active)}`
        }
        autoComplete="off"
        spellCheck={false}
        maxLength={100}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((current) =>
              moveActive(current, event.key === "ArrowDown" ? 1 : -1, results.length),
            );
          } else if (event.key === "Enter") {
            const result = activeResult ?? (showList ? results[0] : undefined);
            if (result !== undefined) {
              event.preventDefault();
              choose(result);
            }
          } else if (event.key === "Escape" && showList) {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Search results"
        className="search-results"
        hidden={!showList}
      >
        {showList && results.length === 0 && (
          <li className="search-empty" role="presentation">
            No matches
          </li>
        )}
        {results.map((result, index) => (
          <li
            key={result.id}
            id={`${listId}-${String(index)}`}
            role="option"
            aria-selected={index === active}
            className="search-option"
            onMouseDown={(event) => {
              event.preventDefault();
              choose(result);
            }}
            onMouseEnter={() => {
              setActive(index);
            }}
          >
            <span className="search-name">{result.displayName}</span>
            {result.parent !== null && (
              <span className="search-context">{result.parent.displayName}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="visually-hidden" role="status" aria-live="polite">
        {showList ? `${String(results.length)} results` : ""}
      </p>
    </div>
  );
}
