import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Upload,
  FileText,
  CheckCircle,
  ArrowUpDown,
  Mail,
  Send,
  Check,
  Edit3,
  ChevronDown,
  ChevronRight,
  ArrowDown,
} from "lucide-react";
import type { SessionActivityLog } from "@shared/schema";

interface SessionTimelineProps {
  sessionId: string;
}

const activityIcons: Record<string, typeof Plus> = {
  session_created: Plus,
  document_uploaded: Upload,
  document_processed: FileText,
  extraction_completed: CheckCircle,
  workflow_status_changed: ArrowUpDown,
  email_received: Mail,
  email_sent: Send,
  field_validated: Check,
  field_edited: Edit3,
};

/**
 * Trim quoted email chain from reply content.
 * Removes everything after common reply markers like "On ... wrote:" or "> " prefixed lines.
 */
function trimEmailChain(body: string): { trimmed: string; wasTrimmed: boolean } {
  const lines = body.split('\n');
  let cutIndex = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Common reply chain markers
    if (
      /^On .+ wrote:$/i.test(line) ||
      /^-{3,}\s*Original Message\s*-{3,}$/i.test(line) ||
      /^_{3,}$/i.test(line) ||
      /^From:\s+.+@.+/i.test(line) && i > 0 ||
      /^>{2,}\s/.test(line)
    ) {
      cutIndex = i;
      break;
    }
    // Block of consecutive quoted lines (> prefix)
    if (/^>\s/.test(line) && i > 0) {
      // Check if there are at least 2 consecutive quoted lines
      const prevLine = lines[i - 1]?.trim();
      if (/^>\s/.test(prevLine) || /^On .+ wrote:$/i.test(prevLine)) {
        cutIndex = i - 1;
        break;
      }
      // Single quoted line followed by more
      if (i + 1 < lines.length && /^>\s/.test(lines[i + 1]?.trim())) {
        cutIndex = i;
        break;
      }
    }
  }

  const trimmed = lines.slice(0, cutIndex).join('\n').trimEnd();
  return { trimmed, wasTrimmed: cutIndex < lines.length };
}

function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if an activity has expandable content
function hasExpandableContent(activity: SessionActivityLog): boolean {
  return (
    activity.activityType === 'email_received' ||
    activity.activityType === 'email_sent' ||
    activity.activityType === 'workflow_status_changed'
  );
}

export default function SessionTimeline({ sessionId }: SessionTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: activities = [], isLoading } = useQuery<SessionActivityLog[]>({
    queryKey: ['/api/sessions', sessionId, 'activity'],
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="text-xs text-gray-500 text-center py-8">
            Loading timeline...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-8">
            No activity recorded yet.
          </div>
        ) : (
          <div className="relative">
            <div className="space-y-0">
              {activities.map((activity: SessionActivityLog, index: number) => {
                const Icon = activityIcons[activity.activityType] || FileText;
                const isExpanded = expandedIds.has(activity.id);
                const expandable = hasExpandableContent(activity);
                const isLast = index === activities.length - 1;
                const metadata = activity.metadata as any;

                // Get email body from metadata if available
                let emailContent: { trimmed: string; wasTrimmed: boolean } | null = null;
                if ((activity.activityType === 'email_received' || activity.activityType === 'email_sent') && metadata?.body) {
                  emailContent = trimEmailChain(metadata.body);
                }

                return (
                  <div key={activity.id}>
                    {/* Activity item */}
                    <div
                      className={`relative flex gap-3 items-start py-2 ${expandable ? 'cursor-pointer hover:bg-[#4F63A4]/[0.03] rounded-lg px-1 -mx-1' : ''}`}
                      onClick={() => expandable && toggleExpand(activity.id)}
                    >
                      {/* Icon */}
                      <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-[#4F63A4] flex items-center justify-center">
                        <Icon className="h-3 w-3 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-900 leading-snug">
                            {activity.description}
                          </p>
                          {expandable && (
                            <div className="flex-shrink-0 mt-0.5">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-[#4F63A4]/50" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-[#4F63A4]/50" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                          {activity.actorEmail && (
                            <>
                              <span className="text-[10px] text-gray-300">&middot;</span>
                              <span className="text-[10px] text-gray-400 truncate">
                                {activity.actorEmail}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="ml-9 mb-2">
                        {/* Status change details */}
                        {activity.activityType === 'workflow_status_changed' && metadata && (
                          <div className="text-[11px] text-gray-500 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-[#4F63A4]/10 text-[#4F63A4] font-medium">
                                {metadata.fromStatus || 'none'}
                              </span>
                              <ArrowDown className="h-3 w-3 text-[#4F63A4]/40 rotate-[-90deg]" />
                              <span className="px-2 py-0.5 rounded bg-[#4F63A4]/10 text-[#4F63A4] font-medium">
                                {metadata.toStatus}
                              </span>
                            </span>
                          </div>
                        )}

                        {/* Email content */}
                        {emailContent && (
                          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mt-1">
                            {metadata?.subject && (
                              <div className="text-[11px] font-medium text-gray-600 mb-1.5">
                                {metadata.subject}
                              </div>
                            )}
                            <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                              {emailContent.trimmed || '(empty)'}
                            </div>
                            {emailContent.wasTrimmed && (
                              <div className="text-[10px] text-gray-400 mt-2 italic">
                                Earlier messages in chain trimmed
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Arrow connector to next item */}
                    {!isLast && (
                      <div className="flex justify-start ml-[11px] -my-0.5">
                        <div className="flex flex-col items-center">
                          <div className="w-px h-2 bg-[#4F63A4]/20" />
                          <ArrowDown className="h-3 w-3 text-[#4F63A4]/30 -my-0.5" />
                          <div className="w-px h-2 bg-[#4F63A4]/20" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
