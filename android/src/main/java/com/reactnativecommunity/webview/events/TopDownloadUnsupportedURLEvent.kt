package com.reactnativecommunity.webview.events

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * Event emitted when download a url not http(s) protocol.
 */
class TopDownloadUnsupportedURLEvent(viewId: Int, private val mEventData: WritableMap) :
  Event<TopDownloadUnsupportedURLEvent>(viewId) {
  companion object {
    const val EVENT_NAME = "topUnsupportedURL"
  }

  override fun getEventName(): String = EVENT_NAME

  override fun canCoalesce(): Boolean = false

  override fun getCoalescingKey(): Short = 0

  override fun dispatch(rctEventEmitter: RCTEventEmitter) =
    rctEventEmitter.receiveEvent(viewTag, eventName, mEventData)
}
