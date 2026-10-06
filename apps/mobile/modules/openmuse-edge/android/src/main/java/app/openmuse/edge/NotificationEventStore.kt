package app.openmuse.edge

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

data class NotificationEvent(
  val id: String = UUID.randomUUID().toString(),
  val packageName: String,
  val postedAt: Long,
  val title: String?,
  val text: String?,
  val subText: String?,
  val category: String?,
  val channelId: String?,
  val isOngoing: Boolean,
  val isGroupSummary: Boolean,
  val importance: Double? = null,
  val actionRequired: Boolean? = null,
  val triageReason: String? = null,
  val triagedAt: Long? = null,
)

object NotificationEventStore {
  private const val DIRECTORY = "edge-events"
  private const val FILE_NAME = "notifications.json"
  private const val MAX_EVENTS = 250

  private val lock = Any()

  private fun file(context: Context): File {
    val directory = File(context.noBackupFilesDir, DIRECTORY)
    if (!directory.exists()) directory.mkdirs()
    return File(directory, FILE_NAME)
  }

  fun append(context: Context, event: NotificationEvent) = synchronized(lock) {
    val events = readInternal(context).toMutableList()
    events.add(0, event)
    writeInternal(context, events.take(MAX_EVENTS))
  }

  fun recent(context: Context, limit: Int = 50): List<NotificationEvent> = synchronized(lock) {
    readInternal(context).take(limit.coerceIn(1, MAX_EVENTS))
  }

  fun find(context: Context, id: String): NotificationEvent? = synchronized(lock) {
    readInternal(context).firstOrNull { it.id == id }
  }

  fun updateTriage(
    context: Context,
    id: String,
    importance: Double,
    actionRequired: Boolean,
    reason: String,
  ) = synchronized(lock) {
    val updated =
      readInternal(context).map { item ->
        if (item.id != id) {
          item
        } else {
          item.copy(
            importance = importance,
            actionRequired = actionRequired,
            triageReason = reason,
            triagedAt = System.currentTimeMillis(),
          )
        }
      }

    writeInternal(context, updated)
  }

  fun clear(context: Context) = synchronized(lock) {
    file(context).delete()
  }

  fun toMap(event: NotificationEvent): Map<String, Any?> =
    mapOf(
      "id" to event.id,
      "packageName" to event.packageName,
      "postedAt" to event.postedAt,
      "title" to event.title,
      "text" to event.text,
      "subText" to event.subText,
      "category" to event.category,
      "channelId" to event.channelId,
      "isOngoing" to event.isOngoing,
      "isGroupSummary" to event.isGroupSummary,
      "importance" to event.importance,
      "actionRequired" to event.actionRequired,
      "triageReason" to event.triageReason,
      "triagedAt" to event.triagedAt,
    )

  private fun readInternal(context: Context): List<NotificationEvent> {
    val source = file(context)
    if (!source.exists()) return emptyList()

    return try {
      val array = JSONArray(source.readText())
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          add(fromJson(item))
        }
      }
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun writeInternal(context: Context, events: List<NotificationEvent>) {
    val array = JSONArray()
    events.forEach { array.put(toJson(it)) }

    val source = file(context)
    val temp = File(source.parentFile, "$FILE_NAME.tmp")
    temp.writeText(array.toString())
    if (source.exists()) source.delete()
    if (!temp.renameTo(source)) {
      source.writeText(temp.readText())
      temp.delete()
    }
  }

  private fun toJson(event: NotificationEvent): JSONObject =
    JSONObject()
      .put("id", event.id)
      .put("packageName", event.packageName)
      .put("postedAt", event.postedAt)
      .put("title", event.title)
      .put("text", event.text)
      .put("subText", event.subText)
      .put("category", event.category)
      .put("channelId", event.channelId)
      .put("isOngoing", event.isOngoing)
      .put("isGroupSummary", event.isGroupSummary)
      .put("importance", event.importance)
      .put("actionRequired", event.actionRequired)
      .put("triageReason", event.triageReason)
      .put("triagedAt", event.triagedAt)

  private fun fromJson(item: JSONObject): NotificationEvent =
    NotificationEvent(
      id = item.optString("id"),
      packageName = item.optString("packageName"),
      postedAt = item.optLong("postedAt"),
      title = item.optNullableString("title"),
      text = item.optNullableString("text"),
      subText = item.optNullableString("subText"),
      category = item.optNullableString("category"),
      channelId = item.optNullableString("channelId"),
      isOngoing = item.optBoolean("isOngoing"),
      isGroupSummary = item.optBoolean("isGroupSummary"),
      importance = item.optNullableDouble("importance"),
      actionRequired =
        if (item.has("actionRequired") && !item.isNull("actionRequired")) {
          item.optBoolean("actionRequired")
        } else {
          null
        },
      triageReason = item.optNullableString("triageReason"),
      triagedAt =
        if (item.has("triagedAt") && !item.isNull("triagedAt")) {
          item.optLong("triagedAt")
        } else {
          null
        },
    )
}

private fun JSONObject.optNullableString(name: String): String? =
  if (has(name) && !isNull(name)) optString(name).takeIf { it.isNotBlank() } else null

private fun JSONObject.optNullableDouble(name: String): Double? =
  if (has(name) && !isNull(name)) optDouble(name) else null
