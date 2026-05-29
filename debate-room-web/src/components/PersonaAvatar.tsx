import type { Persona } from "../domain/types";

interface PersonaAvatarProps {
  persona?: Persona;
  size?: "small" | "medium" | "large" | "hero";
  className?: string;
}

export function PersonaAvatar({ persona, size = "medium", className = "" }: PersonaAvatarProps) {
  const personaId = persona?.id ?? "unknown";
  const src = persona ? `/assets/personas/${persona.id}.png` : undefined;

  return src ? (
    <span className={`persona-image persona-${size} ${className}`} aria-hidden="true">
      <img src={src} alt="" draggable={false} />
    </span>
  ) : (
    <div
      className={`persona-image persona-${personaId} persona-${size} ${className}`}
      aria-hidden="true"
    />
  );
}
