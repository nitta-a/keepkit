import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { useFavorites } from "./FavoriteProvider";
import type { FavoriteInput } from "./types";

export type FavoriteButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "children"
> & {
  item: FavoriteInput;
  children?: ReactNode;
  activeLabel?: ReactNode;
  inactiveLabel?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function FavoriteButton({
  item,
  activeLabel = "Saved",
  inactiveLabel = "Save",
  className,
  style,
  disabled,
  ...buttonProps
}: FavoriteButtonProps) {
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites();
  const saved = isFavorite(item.resourceId);
  const existing = favorites.find((favorite) => favorite.resourceId === item.resourceId);

  async function toggleFavorite() {
    if (saved && existing) {
      await removeFavorite(existing.id);
    } else {
      await addFavorite(item);
    }
  }

  return (
    <button
      {...buttonProps}
      aria-pressed={saved}
      aria-label={
        buttonProps["aria-label"] ?? (saved ? "Remove from favorites" : "Add to favorites")
      }
      className={className}
      disabled={disabled}
      onClick={() => void toggleFavorite()}
      style={style}
      type={buttonProps.type ?? "button"}
    >
      {saved ? activeLabel : inactiveLabel}
    </button>
  );
}
