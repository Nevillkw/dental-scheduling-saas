/**
 * Re-renders on every navigation, so each route entry gets a subtle
 * fade/slide-in — smooth transitions without leaving the brutalist look.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">{children}</div>
  );
}
