package vn.terrawatch.core.client;

import java.util.Map;

/** Sends one push message to one phone through Firebase Cloud Messaging. Never throws: failures come back in {@link Result}. */
public interface FcmSender {
    record Message(String title, String body, Map<String, String> data) {}

    /** {@code unregistered} means FCM says the token is no longer valid and should be forgotten. */
    record Result(boolean ok, boolean unregistered, String error) {
        public static Result sent() {
            return new Result(true, false, null);
        }

        public static Result failed(String error) {
            return new Result(false, false, error);
        }

        public static Result unregisteredToken(String error) {
            return new Result(false, true, error);
        }
    }

    Result send(String fcmToken, Message message);
}
