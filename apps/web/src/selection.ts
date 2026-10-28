import { useCallback, useEffect, useState } from "react";

const PARAM = "object";

function readSelection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const id = new URLSearchParams(window.location.search).get(PARAM);
  return id === null || id === "" ? null : id;
}

export function useSelection(): [string | null, (id: string | null) => void] {
  const [selectedId, setSelectedId] = useState(readSelection);

  useEffect(() => {
    const onPopState = () => {
      setSelectedId(readSelection());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const select = useCallback((id: string | null) => {
    if (id === readSelection()) {
      return;
    }
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(PARAM);
    } else {
      url.searchParams.set(PARAM, id);
    }
    window.history.pushState(null, "", url);
    setSelectedId(id);
  }, []);

  return [selectedId, select];
}
