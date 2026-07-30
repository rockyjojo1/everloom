export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    inventory: "M4 7h16l-1 13H5L4 7Zm4 0V5a4 4 0 0 1 8 0v2",
    skills: "M4 19 19 4m-9 1 3 3m3 3 3 3M5 14l5 5-2 2-5-5 2-2Z",
    quest: "M6 3h12v18H6V3Zm3 5h6m-6 4h6m-6 4h4",
    collection: "M4 5h16v14H4V5Zm4 0V3h8v2M8 9h8m-8 4h8",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
    bag: "M6 8h12l1 13H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2",
    close: "m6 6 12 12M18 6 6 18",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] ?? paths.bag} /></svg>;
}

