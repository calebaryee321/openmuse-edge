package app.openmuse.edge

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.flow.collect
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

class OpenMuseEdgeModule : Module() {
  private var engine: Engine? = null
  private var activeConversation: Conversation? = null
  private var loadedModelPath: String? = null
  private var loadedBackend: String? = null

  override fun definition() = ModuleDefinition {
    Name("OpenMuseEdge")

    Events("onGenerationToken", "onGenerationComplete", "onGenerationError")

    Function("getRuntimeStats") {
      runtimeStats()
    }

    Function("hasNotificationAccess") {
      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      val component =
        ComponentName(
          context,
          OpenMuseNotificationListenerService::class.java,
        ).flattenToString()

      Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners",
      )?.split(":")?.any { it.equals(component, ignoreCase = true) } == true
    }

    Function("openNotificationAccessSettings") {
      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      val intent =
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

      context.startActivity(intent)
      true
    }

    Function("getRecentNotificationEvents") { limit: Int ->
      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      NotificationEventStore.recent(context, limit).map(NotificationEventStore::toMap)
    }

    Function("clearNotificationEvents") {
      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      NotificationEventStore.clear(context)
      true
    }

    Function("updateNotificationTriage") {
        id: String,
        importance: Double,
        actionRequired: Boolean,
        reason: String,
      ->
      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      NotificationEventStore.updateTriage(
        context,
        id,
        importance.coerceIn(0.0, 1.0),
        actionRequired,
        reason,
      )
      true
    }

    AsyncFunction("loadModel") Coroutine { modelPath: String, backend: String ->
      unloadInternal()

      val context =
        requireNotNull(appContext.reactContext?.applicationContext) {
          "Android application context is unavailable."
        }

      Engine.setNativeMinLogSeverity(LogSeverity.ERROR)

      val requested = backend.lowercase()
      val candidates =
        when (requested) {
          "npu" -> listOf("npu")
          "gpu" -> listOf("gpu")
          "cpu" -> listOf("cpu")
          else -> listOf("npu", "gpu", "cpu")
        }

      var lastError: Throwable? = null

      for (candidate in candidates) {
        try {
          val runtimeBackend =
            when (candidate) {
              "npu" -> Backend.NPU(nativeLibraryDir = context.applicationInfo.nativeLibraryDir)
              "gpu" -> Backend.GPU()
              else -> Backend.CPU()
            }

          val candidateEngine =
            Engine(
              EngineConfig(
                modelPath = modelPath,
                backend = runtimeBackend,
                cacheDir = context.cacheDir.path,
              ),
            )

          candidateEngine.initialize()

          engine = candidateEngine
          loadedModelPath = modelPath
          loadedBackend = candidate

          return@Coroutine runtimeStats()
        } catch (error: Throwable) {
          lastError = error
        }
      }

      throw IllegalStateException(
        "Unable to initialize LiteRT-LM for backend '$backend'.",
        lastError,
      )
    }

    AsyncFunction("unloadModel") {
      unloadInternal()
      runtimeStats()
    }

    AsyncFunction("sha256File") Coroutine { filePath: String ->
      val normalizedPath = filePath.removePrefix("file://")
      val file = File(normalizedPath)

      require(file.exists() && file.isFile) {
        "Model file does not exist: $filePath"
      }

      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)

      FileInputStream(file).use { input ->
        while (true) {
          val count = input.read(buffer)
          if (count <= 0) break
          digest.update(buffer, 0, count)
        }
      }

      digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    AsyncFunction("generate") Coroutine { prompt: String ->
      val loadedEngine = requireEngine()

      loadedEngine.createConversation().use { conversation ->
        activeConversation = conversation
        try {
          conversation.sendMessage(prompt).toString()
        } finally {
          activeConversation = null
        }
      }
    }

    AsyncFunction("streamGenerate") Coroutine { prompt: String ->
      val loadedEngine = requireEngine()
      val output = StringBuilder()

      loadedEngine.createConversation().use { conversation ->
        activeConversation = conversation

        try {
          conversation.sendMessageAsync(prompt).collect { message ->
            val text = message.toString()
            output.append(text)
            this@OpenMuseEdgeModule.sendEvent(
              "onGenerationToken",
              mapOf("text" to text),
            )
          }

          val result = output.toString()
          this@OpenMuseEdgeModule.sendEvent(
            "onGenerationComplete",
            mapOf("text" to result),
          )
          result
        } catch (error: Throwable) {
          this@OpenMuseEdgeModule.sendEvent(
            "onGenerationError",
            mapOf("message" to (error.message ?: error::class.java.simpleName)),
          )
          throw error
        } finally {
          activeConversation = null
        }
      }
    }

    Function("cancelGeneration") {
      activeConversation?.cancelProcess()
      true
    }

    OnDestroy {
      unloadInternal()
    }
  }

  private fun requireEngine(): Engine =
    requireNotNull(engine) {
      "No local model is loaded. Call loadModel() before generation."
    }

  private fun unloadInternal() {
    activeConversation?.let { conversation ->
      try {
        conversation.cancelProcess()
      } catch (_: Throwable) {
      }

      try {
        conversation.close()
      } catch (_: Throwable) {
      }
    }

    activeConversation = null

    engine?.let { loadedEngine ->
      try {
        loadedEngine.close()
      } catch (_: Throwable) {
      }
    }

    engine = null
    loadedModelPath = null
    loadedBackend = null
  }

  private fun runtimeStats(): Map<String, Any?> =
    mapOf(
      "available" to true,
      "loaded" to (engine != null),
      "modelPath" to loadedModelPath,
      "backend" to loadedBackend,
    )
}
