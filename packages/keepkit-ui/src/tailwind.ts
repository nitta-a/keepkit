/**
 * Tailwind v4 theme aliases. Import `@keepkit/ui/tailwind.css` in the CSS entry
 * point, then use these names when a JavaScript theme map is more convenient.
 */
export const keepKitTheme = {
  colors: {
    background: "var(--keep-background)",
    foreground: "var(--keep-foreground)",
    card: "var(--keep-card)",
    "card-foreground": "var(--keep-card-foreground)",
    "card-border": "var(--keep-card-border)",
    "surface-border": "var(--keep-surface-border)",
    "surface-background": "var(--keep-surface-background)",
    muted: "var(--keep-muted)",
    "muted-foreground": "var(--keep-muted-foreground)",
    border: "var(--keep-border)",
    input: "var(--keep-input)",
    primary: "var(--keep-primary)",
    "primary-foreground": "var(--keep-primary-foreground)",
    destructive: "var(--keep-destructive)",
    "destructive-foreground": "var(--keep-destructive-foreground)",
    success: "var(--keep-success)",
    warning: "var(--keep-warning)",
    ring: "var(--keep-ring)",
  },
  borderRadius: {
    sm: "calc(var(--keep-radius) - 4px)",
    md: "calc(var(--keep-radius) - 2px)",
    lg: "var(--keep-radius)",
  },
  spacing: {
    card: "var(--keep-card-padding)",
    gap: "var(--keep-card-gap)",
    control: "var(--keep-control-gap)",
    icon: "var(--keep-icon-size)",
  },
} as const;

export type KeepKitTheme = typeof keepKitTheme;
