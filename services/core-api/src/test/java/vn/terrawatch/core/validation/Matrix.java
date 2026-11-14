package vn.terrawatch.core.validation;

import org.springframework.http.HttpMethod;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.IntFunction;
import java.util.function.UnaryOperator;
import java.util.stream.Stream;

import vn.terrawatch.core.validation.ValidationTestBase.Req;

/** Table plumbing: a {@link Route} (endpoint + valid base request) and a {@link Cases} builder that fills its rows. */
final class Matrix {
    private Matrix() {}

    record Route(HttpMethod method, String template, int okStatus, Function<ValidationTestBase, Req> prepare) {
        String label() { return method + " " + template; }
    }

    static Route route(String methodAndPath, int okStatus, Function<ValidationTestBase, Req> prepare) {
        String[] parts = methodAndPath.split(" ", 2);
        return new Route(HttpMethod.valueOf(parts[0]), parts[1], okStatus, prepare);
    }

    /** One table row: edit the valid base body (or send {@code raw}), expect {@code status} and, when given, the error message. */
    record Case(Route route, String what, UnaryOperator<Map<String, Object>> edit, String raw, int status, String message) {
        @Override public String toString() { return route.label() + " " + what + " -> " + status; }
    }

    static UnaryOperator<Map<String, Object>> set(String field, Object value) {
        return m -> { m.put(field, value); return m; };
    }

    static UnaryOperator<Map<String, Object>> drop(String field) {
        return m -> { m.remove(field); return m; };
    }

    static UnaryOperator<Map<String, Object>> sameBody() { return m -> m; }

    static final String INVALID = "Invalid request";

    static String a(int n) { return "a".repeat(n); }

    /** Row builder for one route. Every method returns {@code this}. */
    static final class Cases {
        private final Route r;
        private final List<Case> rows = new ArrayList<>();

        Cases(Route r) { this.r = r; }

        Stream<Case> stream() { return rows.stream(); }

        Cases row(String what, int status, String message, UnaryOperator<Map<String, Object>> edit) {
            rows.add(new Case(r, what, edit, null, status, message));
            return this;
        }

        Cases ok(String what, UnaryOperator<Map<String, Object>> edit) { return row(what, r.okStatus(), null, edit); }
        /** Bean Validation refusal: 400 with the shared {"message":"Invalid request"} body. */
        Cases bad(String what, UnaryOperator<Map<String, Object>> edit) { return row(what, 400, INVALID, edit); }
        Cases status(String what, int status, UnaryOperator<Map<String, Object>> edit) { return row(what, status, null, edit); }
        Cases message(String what, int status, String message, UnaryOperator<Map<String, Object>> edit) { return row(what, status, message, edit); }

        Cases raw(String what, int status, String raw) {
            rows.add(new Case(r, what, null, raw, status, status == 400 ? INVALID : null));
            return this;
        }

        /** Body shape (pass 0 as the status to skip the empty-object row when it is a documented finding): valid, unknown fields ignored, empty/garbled/non-object bodies -> 400. */
        Cases envelope(int emptyObjectStatus) { return envelope(emptyObjectStatus, emptyObjectStatus == 400 ? INVALID : null); }

        Cases envelope(int emptyObjectStatus, String emptyObjectMessage) {
            ok("valid request", sameBody());
            ok("unknown extra field is ignored", set("unexpectedField", "x"));
            if (emptyObjectStatus > 0) row("empty object {}", emptyObjectStatus, emptyObjectMessage, m -> new java.util.LinkedHashMap<>());
            raw("malformed JSON", 400, "{");
            raw("truncated JSON", 400, "{\"a\":");
            raw("empty body", 400, "");
            raw("JSON array instead of object", 400, "[]");
            raw("JSON null body", 400, "null");
            raw("JSON string instead of object", 400, "\"text\"");
            return this;
        }

        /** Identity fields in the body must be ignored (the signed-in user / citizen role always wins). */
        Cases ignoresIdentityFields() {
            return ok("client-sent role and userId are ignored", m -> { m.put("role", "admin"); m.put("userId", "33333333-3333-3333-3333-333333333333"); return m; });
        }

        /** Each field: missing, null, "" and "   " are all refused with 400. */
        Cases required(String... fields) {
            for (String f : fields) {
                bad(f + " missing", drop(f));
                bad(f + " null", set(f, null));
                bad(f + " empty string", set(f, ""));
                bad(f + " whitespace only", set(f, "   "));
            }
            return this;
        }

        /** Each field: missing and null are refused with 400. */
        Cases nonNull(String... fields) {
            for (String f : fields) {
                bad(f + " missing", drop(f));
                bad(f + " null", set(f, null));
            }
            return this;
        }

        /** String length bounds: min-1 refused (when min > 1), min accepted (when min > 1), max accepted, max+1 refused. */
        Cases length(String field, int min, int max) { return length(field, min, max, Matrix::a); }

        Cases length(String field, int min, int max, IntFunction<Object> value) {
            if (min > 1) {
                bad(field + " length " + (min - 1), set(field, value.apply(min - 1)));
                ok(field + " length " + min, set(field, value.apply(min)));
            }
            ok(field + " length " + max, set(field, value.apply(max)));
            bad(field + " length " + (max + 1), set(field, value.apply(max + 1)));
            return this;
        }

        /** Wrong JSON type for each string field: an object and an array. */
        Cases notText(String... fields) {
            for (String f : fields) {
                bad(f + " is a JSON object", set(f, Map.of("x", 1)));
                bad(f + " is a JSON array", set(f, List.of(1)));
            }
            return this;
        }

        /** Wrong JSON type for one non-text field: each given value must be refused. */
        Cases notType(String field, Object... values) {
            for (Object v : values) bad(field + " = " + v + " (wrong type)", set(field, v));
            return this;
        }

        /** Allowed values accepted, disallowed values refused. */
        Cases oneOf(String field, List<String> allowed, List<String> refused) {
            for (String v : allowed) ok(field + " = \"" + v + "\"", set(field, v));
            for (String v : refused) bad(field + " = \"" + v + "\"", set(field, v));
            return this;
        }
    }
}
