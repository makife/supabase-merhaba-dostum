import Foundation
import FirebaseCore
import FirebaseMessaging

public let isCapacitorApp = true

public enum FirebaseBridge {
    public static func configureIfNeeded() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }

    public static func setAPNSToken(_ deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }
}
