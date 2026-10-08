// Recréé à chaque navigation : la page entre en fondu avec un léger glissement.
// Animation en CSS (.page-enter), donc visible même avant le chargement du JavaScript ;
// coupée par le bouton « Effets » et par prefers-reduced-motion.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
