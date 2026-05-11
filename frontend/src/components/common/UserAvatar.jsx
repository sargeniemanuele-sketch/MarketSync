import { useEffect, useState } from "react";

const SIZE_CLASSES = {
  xs: "h-6 w-6 text-xs",
  sm: "h-14 w-14 text-lg",
  lg: "h-24 w-24 text-2xl",
};

function getInitials(user) {
  const name = String(user?.name ?? "").trim();

  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  const email = String(user?.email ?? "").trim();
  return email ? email[0].toUpperCase() : "U";
}

/**
 * Avatar utente con fallback alle iniziali.
 *
 * Props:
 *   user     — oggetto con name, email, avatarUrl
 *   size     — "xs" | "sm" | "lg" (default "lg")
 *   className — classi aggiuntive (es. ring per ProfilePage)
 */
export default function UserAvatar({ user, size = "lg", className = "" }) {
  const avatarUrl = user?.avatarUrl ?? null;
  const [hasAvatarError, setHasAvatarError] = useState(false);

  useEffect(() => {
    setHasAvatarError(false);
  }, [avatarUrl]);

  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.lg;

  return (
    <div
      className={[
        "relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-100",
        sizeClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{getInitials(user)}</span>
      {avatarUrl && !hasAvatarError ? (
        <img
          alt={`Foto profilo di ${user?.name || "utente"}`}
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          onError={() => setHasAvatarError(true)}
          referrerPolicy="no-referrer"
          src={avatarUrl}
        />
      ) : null}
    </div>
  );
}
