import { Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const [, navigate] = useLocation();

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600">
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          {item.href ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.href!)}
              className="p-1 h-auto hover:bg-gray-100 font-medium"
            >
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </Button>
          ) : (
            <span className="font-medium text-gray-900 flex items-center">
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}