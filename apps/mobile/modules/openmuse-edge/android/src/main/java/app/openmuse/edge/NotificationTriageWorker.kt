package app.openmuse.edge

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class NotificationTriageWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val eventId = inputData.getString(KEY_EVENT_ID) ?: return Result.failure()
    val event = NotificationEventStore.find(applicationContext, eventId) ?: return Result.success()

    val haystack =
      listOfNotNull(event.title, event.text, event.subText, event.category)
        .joinToString(" ")
        .lowercase()

    var importance = 0.30
    var actionRequired = false
    val reasons = mutableListOf<String>()

    val urgentWords =
      listOf(
        "urgent",
        "asap",
        "immediately",
        "action required",
        "deadline",
        "overdue",
        "payment due",
        "security alert",
        "verification code",
      )

    val actionWords =
      listOf(
        "please review",
        "please respond",
        "reply",
        "approve",
        "confirm",
        "complete",
        "sign",
        "due",
        "meeting",
        "appointment",
      )

    if (urgentWords.any(haystack::contains)) {
      importance += 0.45
      reasons += "urgent language"
    }

    if (actionWords.any(haystack::contains)) {
      importance += 0.25
      actionRequired = true
      reasons += "action language"
    }

    if (event.category in setOf("call", "msg", "email", "event", "reminder", "alarm")) {
      importance += 0.10
      reasons += "high-value category"
    }

    if (event.isOngoing) {
      importance -= 0.20
      reasons += "ongoing notification"
    }

    NotificationEventStore.updateTriage(
      applicationContext,
      eventId,
      importance.coerceIn(0.0, 1.0),
      actionRequired,
      reasons.joinToString(", ").ifBlank { "queued for Scout" },
    )

    return Result.success()
  }

  companion object {
    const val KEY_EVENT_ID = "event_id"
    const val TAG = "openmuse-notification-triage"
  }
}
