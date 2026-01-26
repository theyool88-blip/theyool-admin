import {
  Calendar,
  Clock,
  FileText,
  FileWarning,
  Mail,
  AlertTriangle,
  User,
  Link2,
  BarChart3,
  LucideIcon
} from 'lucide-react'
import type { NoticeCategory } from '@/types/case-notice'

/**
 * Notice icon mapping using Lucide React icons
 * Professional SVG icons to replace emoji representations
 */
export const NOTICE_ICONS: Record<NoticeCategory, LucideIcon> = {
  next_hearing: Calendar,
  deadline: Clock,
  brief_required: FileText,
  document_issue: FileWarning,
  evidence_pending: Mail,
  schedule_conflict: AlertTriangle,
  client_role_confirm: User,
  unlinked_related_case: Link2,
  unlinked_lower_court: BarChart3,
}

/**
 * Color mapping based on category severity and semantic meaning
 * Uses design system CSS variables for theme consistency
 */
export const NOTICE_ICON_COLORS: Record<NoticeCategory, string> = {
  next_hearing: 'text-[var(--sage-primary)]',      // Green - positive/upcoming
  deadline: 'text-[var(--color-warning)]',         // Stone Gray - attention needed
  brief_required: 'text-[var(--color-info)]',      // Slate Gray - informational
  document_issue: 'text-[var(--color-danger)]',    // Muted Red - error/problem
  evidence_pending: 'text-[var(--color-info)]',    // Slate Gray - waiting/informational
  schedule_conflict: 'text-[var(--color-warning)]', // Stone Gray - warning
  client_role_confirm: 'text-[var(--sage-primary)]', // Green - action required
  unlinked_related_case: 'text-[var(--color-info)]',  // Slate Gray - informational
  unlinked_lower_court: 'text-[var(--color-info)]',   // Slate Gray - informational
}
