package app.openmuse.edge

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class OpenMuseNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val posted = sbn ?: return
    if (posted.packageName == packageName) return

    val notification = posted.notification ?: return
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

    val extras = notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text =
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()

    if (title.isNullOrBlank() && text.isNullOrBlank()) return

    val event =
      NotificationEvent(
        packageName = posted.packageName,
        postedAt = posted.postTime,
        title = title,
        text = text,
        subText = subText,
        category = notification.category,
        channelId = notification.channelId,
        isOngoing = posted.isOngoing,
        isGroupSummary = false,
      )

    NotificationEventStore.append(applicationContext, event)

    val input =
      Data.Builder()
        .putString(NotificationTriageWorker.KEY_EVENT_ID, event.id)
        .build()

    val request =
      OneTimeWorkRequestBuilder<NotificationTriageWorker>()
        .setInputData(input)
        .addTag(NotificationTriageWorker.TAG)
        .build()

    WorkManager.getInstance(applicationContext).enqueue(request)
  }
}
