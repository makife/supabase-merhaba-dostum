import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var lastPublishedFCMToken: String?
    private var pendingAPNsToken: Data?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        configurePlaybackAudioSession()
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configurePlaybackAudioSession()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // APNs token'ı sakla
        pendingAPNsToken = deviceToken
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 [Push] APNs token alındı: \(tokenString.prefix(20))...")

        // Firebase'e APNs token'ı ver
        Messaging.messaging().apnsToken = deviceToken

        // FCM token'ı al — retry ile
        fetchFCMTokenWithRetry(attempt: 1)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ [Push] Remote notification kayıt hatası: \(error.localizedDescription)")
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    /// FCM token'ı retry ile almayı dener (iOS'ta APNs → FCM mapping zaman alabilir)
    private func fetchFCMTokenWithRetry(attempt: Int) {
        let maxAttempts = 3
        let delaySeconds: [Double] = [0, 2.0, 5.0]

        let delay = attempt <= delaySeconds.count ? delaySeconds[attempt - 1] : 5.0

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self = self else { return }

            Messaging.messaging().token { [weak self] token, error in
                guard let self = self else { return }

                if let error = error {
                    print("⚠️ [Push] FCM token alınamadı (deneme \(attempt)/\(maxAttempts)): \(error.localizedDescription)")

                    if attempt < maxAttempts {
                        self.fetchFCMTokenWithRetry(attempt: attempt + 1)
                    } else {
                        print("❌ [Push] FCM token \(maxAttempts) denemede de alınamadı")
                        NotificationCenter.default.post(
                            name: .capacitorDidFailToRegisterForRemoteNotifications,
                            object: error
                        )
                    }
                    return
                }

                guard let token = token, !token.isEmpty else {
                    print("⚠️ [Push] FCM token boş (deneme \(attempt)/\(maxAttempts))")

                    if attempt < maxAttempts {
                        self.fetchFCMTokenWithRetry(attempt: attempt + 1)
                    } else {
                        let tokenError = NSError(
                            domain: "KelimelePush",
                            code: 1,
                            userInfo: [NSLocalizedDescriptionKey: "FCM token \(maxAttempts) denemede üretilemedi"]
                        )
                        NotificationCenter.default.post(
                            name: .capacitorDidFailToRegisterForRemoteNotifications,
                            object: tokenError
                        )
                    }
                    return
                }

                print("✅ [Push] FCM token alındı (deneme \(attempt)): \(token.prefix(30))...")
                self.publishFCMToken(token)
            }
        }
    }

    private func publishFCMToken(_ token: String) {
        guard !token.isEmpty, token != lastPublishedFCMToken else { return }
        lastPublishedFCMToken = token

        print("📱 [Push] FCM token Capacitor'e gönderiliyor: \(token.prefix(30))...")
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: token
        )
    }

    private func configurePlaybackAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            print("🔊 [Audio] AVAudioSession playback aktif")
        } catch {
            print("⚠️ [Audio] AVAudioSession ayarlanamadı: \(error.localizedDescription)")
        }
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }
}

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken = fcmToken, !fcmToken.isEmpty else {
            print("⚠️ [Push] MessagingDelegate: boş FCM token")
            return
        }
        print("📱 [Push] MessagingDelegate: yeni FCM token: \(fcmToken.prefix(30))...")
        publishFCMToken(fcmToken)
    }
}
