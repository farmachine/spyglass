import ExtraplLogo from "@/components/ExtraplLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface TenantNotFoundProps {
  subdomain: string;
}

export default function TenantNotFound({ subdomain }: TenantNotFoundProps) {
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'extrapl.io';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-6">
          <div className="flex justify-center">
            <ExtraplLogo />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Organization Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              The organization <span className="font-medium text-gray-900 dark:text-gray-100">{subdomain}.{baseDomain}</span> does not exist or is not configured.
            </p>
          </div>
          
          <div className="pt-4 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              If you believe this is an error, please contact your organization administrator.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.href = `https://${baseDomain}`}
            >
              Go to extrapl Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
