import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { navigationRef } from '../navigation/navigationRef'
import { navigateFromNotificationMobileLink } from '../services/notificationDeepLink'
import { markAsRead } from '../services/notifications'
import { registerPushToken } from '../services/pushNotifications'

const NAV_RETRY_MS = 200
const NAV_GIVE_UP_MS = 8000

/**
 * Keeps this phone's push token saved for the signed-in user, and opens the right screen when a push
 * is tapped -- including a tap that launched the app, which arrives before sign-in has finished.
 *
 * @param {{ userId: string | null | undefined, mainAppReady: boolean }} args
 *   mainAppReady: the signed-in, onboarded screens are mounted, so their routes exist.
 */
export function usePushNotifications({ userId, mainAppReady }) {
  // Refresh the token on every app start / sign-in (tokens can change; it also re-claims the token if
  // another account last used this phone). Does nothing until permission is granted.
  useEffect(() => {
    if (!userId) return
    registerPushToken()
    const sub = Notifications.addPushTokenListener(() => registerPushToken())
    return () => sub.remove()
  }, [userId])

  // Tap handling. useLastNotificationResponse covers both a tap while running and the tap that cold-
  // started the app. Each response is handled once.
  const response = Notifications.useLastNotificationResponse()
  const handledIds = useRef(new Set())

  useEffect(() => {
    if (!response || !userId || !mainAppReady) return
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
    const id = response.notification.request.identifier
    if (handledIds.current.has(id)) return
    handledIds.current.add(id)

    const data = response.notification.request.content.data || {}
    if (data.notification_id) markAsRead(data.notification_id, userId).catch(() => {})

    // The main stack mounts in the same render that flips mainAppReady; wait until its routes exist.
    const started = Date.now()
    let timer = null
    const attempt = () => {
      const routeNames = navigationRef.isReady() ? navigationRef.getRootState()?.routeNames : null
      if (!routeNames?.includes('MainTabs')) {
        if (Date.now() - started < NAV_GIVE_UP_MS) timer = setTimeout(attempt, NAV_RETRY_MS)
        return
      }
      const opened = navigateFromNotificationMobileLink(navigationRef, data.mobile_link)
      if (!opened) navigationRef.navigate('Notifications')
    }
    attempt()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [response, userId, mainAppReady])
}
