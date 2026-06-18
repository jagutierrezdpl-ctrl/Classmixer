/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"

type NotificationType =
  | "questionnaire_complete"
  | "bullying_risk"
  | "proposal_generated"
  | "rule_conflict"
  | "process_status"

interface PushNotificationParams {
  centerId: string
  type: NotificationType
  title: string
  message: string
  processId?: string
  entityType?: string
  entityId?: string
  userId?: string   // null = all admins of center
}

export async function pushNotification(params: PushNotificationParams): Promise<void> {
  try {
    const supabase = createServiceClient() as any
    await supabase.from("app_notifications").insert({
      center_id: params.centerId,
      user_id: params.userId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      process_id: params.processId ?? null,
      read: false,
    })
  } catch {
    // Non-critical — never let notification failure break the main flow
  }
}
