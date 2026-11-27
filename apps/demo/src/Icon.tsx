import type { KeepUiIcons } from "@keepkit/ui/ui-provider";

const paths = {
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  check: "m5 12 4 4L19 6",
  clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  all: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inbox: "M4 4h16l2 13v3H2v-3L4 4Z M2 15h6l2 3h4l2-3h6",
  pinned: "m9 3 6 0 0 5 4 4v2H5v-2l4-4V3Z M12 14v7",
  unread: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3V4Z M12 6v16",
  archive: "M3 3h18v4H3z M5 7v14h14V7 M9 11h6",
  collections: "M3 6h7l2 2h9v12H3V6Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  plus: "M12 5v14 M5 12h14",
  filter: "M4 6h16 M7 12h10 M10 18h4",
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export const demoIcons = {
  save: <Icon name="bookmark" />,
  saved: <Icon name="check" />,
  collection: <Icon name="collections" />,
  status: { available: <Icon name="check" />, expired: <Icon name="clock" /> },
} satisfies KeepUiIcons;
