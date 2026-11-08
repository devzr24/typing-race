import Image from "next/image";

/** Photo de profil, ou initiale du nom si aucune photo. */
export function Avatar({ name, image }: { name: string; image: string | null | undefined }) {
  // Les photos téléversées sont déjà redimensionnées par le serveur (ADR 0019) : pas de seconde optimisation.
  if (image) return <Image src={image} alt="" width={32} height={32} className="rounded-full" unoptimized={image.startsWith("/api/avatars/")} />;
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-steel text-sm font-medium uppercase"
    >
      {name.charAt(0)}
    </span>
  );
}
