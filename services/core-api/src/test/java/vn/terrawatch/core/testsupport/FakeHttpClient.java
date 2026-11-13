package vn.terrawatch.core.testsupport;

import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Flow;
import java.util.concurrent.atomic.AtomicReference;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;

/**
 * In-memory JDK HttpClient for classes that build their own client in a private final field. Tests swap it in by
 * reflection ({@link #inject}); no socket is opened. Only {@code BodyHandlers.ofString()} is supported.
 */
public class FakeHttpClient extends HttpClient {
    public interface Handler {
        Reply handle(Sent request) throws IOException, InterruptedException;
    }

    /** What the code under test sent, with the body already read. */
    public record Sent(HttpRequest request, String body) {
        public String header(String name) {
            return request.headers().firstValue(name).orElse(null);
        }
    }

    public record Reply(int status, String body, Map<String, List<String>> headers) {
        public static Reply of(int status, String body) {
            return new Reply(status, body, Map.of());
        }
    }

    public final List<Sent> sent = new ArrayList<>();
    private Handler handler;

    public FakeHttpClient(Handler handler) {
        this.handler = handler;
    }

    public void respondWith(Handler next) {
        this.handler = next;
    }

    /** Replaces the private {@code http} field of {@code target}. */
    public static FakeHttpClient inject(Object target, Handler handler) {
        FakeHttpClient fake = new FakeHttpClient(handler);
        try {
            var field = target.getClass().getDeclaredField("http");
            field.setAccessible(true);
            field.set(target, fake);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return fake;
    }

    /** Sets a private field (used to move the clock-like fields of classes with no clock seam). */
    public static void setField(Object target, String name, Object value) {
        try {
            var field = target.getClass().getDeclaredField(name);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> handlerIgnored) throws IOException, InterruptedException {
        Sent s = new Sent(request, readBody(request));
        sent.add(s);
        Reply reply = handler.handle(s);
        return (HttpResponse<T>) new FakeResponse(request, reply);
    }

    private static String readBody(HttpRequest request) {
        if (request.bodyPublisher().isEmpty()) return "";
        StringBuilder out = new StringBuilder();
        AtomicReference<Throwable> error = new AtomicReference<>();
        request.bodyPublisher().get().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer item) { out.append(StandardCharsets.UTF_8.decode(item)); }
            public void onError(Throwable throwable) { error.set(throwable); }
            public void onComplete() { }
        });
        if (error.get() != null) throw new IllegalStateException(error.get());
        return out.toString();
    }

    private record FakeResponse(HttpRequest request, Reply reply) implements HttpResponse<String> {
        public int statusCode() { return reply.status(); }
        public Optional<HttpResponse<String>> previousResponse() { return Optional.empty(); }
        public HttpHeaders headers() { return HttpHeaders.of(reply.headers(), (a, b) -> true); }
        public String body() { return reply.body(); }
        public Optional<javax.net.ssl.SSLSession> sslSession() { return Optional.empty(); }
        public URI uri() { return request.uri(); }
        public Version version() { return Version.HTTP_1_1; }
    }

    @Override public Optional<CookieHandler> cookieHandler() { return Optional.empty(); }
    @Override public Optional<Duration> connectTimeout() { return Optional.empty(); }
    @Override public Redirect followRedirects() { return Redirect.NEVER; }
    @Override public Optional<ProxySelector> proxy() { return Optional.empty(); }
    @Override public SSLContext sslContext() { throw new UnsupportedOperationException(); }
    @Override public SSLParameters sslParameters() { return new SSLParameters(); }
    @Override public Optional<Authenticator> authenticator() { return Optional.empty(); }
    @Override public Version version() { return Version.HTTP_1_1; }
    @Override public Optional<Executor> executor() { return Optional.empty(); }

    @Override
    public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> h) {
        throw new UnsupportedOperationException();
    }

    @Override
    public <T> CompletableFuture<HttpResponse<T>> sendAsync(HttpRequest request, HttpResponse.BodyHandler<T> h,
                                                           HttpResponse.PushPromiseHandler<T> p) {
        throw new UnsupportedOperationException();
    }
}
