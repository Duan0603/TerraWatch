package vn.terrawatch.core.client;

/** Sends one SMS to one phone number. Never throws: failures come back in {@link Result}. */
public interface SmsSender {
    record Result(boolean ok, String providerMessageId, String error) {
        public static Result sent(String sid) { return new Result(true, sid, null); }
        public static Result failed(String error) { return new Result(false, null, error); }
    }

    Result send(String phoneNumber, String body);
}

