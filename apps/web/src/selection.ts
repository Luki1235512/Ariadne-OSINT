import { useCallback, useEffect, useState } from "react";

const PARAM = "object";

export interface Selection {
  id: string | null;
  focus: boolean;
}

function readSelection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const id = new URLSearchParams(window.location.search).get(PARAM);
  return id === null || id === "" ? null : id;
}

export function useSelection(): [Selection, (id: string | null, focus?: boolean) => void] {
  const [selection, setSelection] = useState<Selection>(() => ({
    id: readSelection(),
    focus: true,
  }));

  useEffect(() => {
    const onPopState = () => {
      setSelection({ id: readSelection(), focus: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const select = useCallback((id: string | null, focus = false) => {
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
    setSelection({ id, focus });
  }, []);

  return [selection, select];
}
