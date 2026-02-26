import { Button } from "@/components/ui/button";
import { MessageCircle, Bot, Clock, X } from "lucide-react";
import SessionMessenger from "./SessionMessenger";
import SessionAssistant from "./SessionAssistant";
import SessionTimeline from "./SessionTimeline";
import type { FieldValidation, ExtractionSession, Project } from "@shared/schema";

export type PanelTab = 'messenger' | 'assistant' | 'timeline';

export const panelTabs: { id: PanelTab; label: string; icon: typeof MessageCircle }[] = [
  { id: 'messenger', label: 'Messenger', icon: MessageCircle },
  { id: 'assistant', label: 'Assistant', icon: Bot },
  { id: 'timeline', label: 'Timeline', icon: Clock },
];

interface SessionPanelProps {
  sessionId: string;
  session: ExtractionSession;
  validations: FieldValidation[];
  project: Project;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
}

export default function SessionPanel({ sessionId, session, validations, project, activeTab, onTabChange, onClose }: SessionPanelProps) {
  const activeTabConfig = panelTabs.find(t => t.id === activeTab)!;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {panelTabs.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${
                  activeTab === id
                    ? 'bg-[#4F63A4]/10 text-[#4F63A4]'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700'
                }`}
                onClick={() => onTabChange(id)}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {activeTabConfig.label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'messenger' && (
          <SessionMessenger sessionId={sessionId} project={project} />
        )}
        {activeTab === 'assistant' && (
          <SessionAssistant sessionId={sessionId} session={session} validations={validations} />
        )}
        {activeTab === 'timeline' && (
          <SessionTimeline sessionId={sessionId} />
        )}
      </div>
    </div>
  );
}
