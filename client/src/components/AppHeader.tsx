import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <div className="fixed top-4 right-16 z-50">
      <ThemeToggle />
    </div>
  );
}