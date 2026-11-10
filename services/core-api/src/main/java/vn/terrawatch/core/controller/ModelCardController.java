package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.terrawatch.core.client.AiServiceClient;

import java.util.Map;

/** Story 4.29: officers and admins read the model cards (the AI service itself is not exposed by the gateway). */
@RestController
@RequestMapping("/api/v1/model-card")
@Tag(name = "Model card")
public class ModelCardController {

    private final AiServiceClient ai;

    public ModelCardController(AiServiceClient ai) {
        this.ai = ai;
    }

    @GetMapping
    @Operation(summary = "Thẻ mô hình phân đoạn và GRU, đúng như AI service báo (cán bộ và admin)")
    public Map<String, Object> get() {
        return Map.of("segmentation", ai.segmentationCard(), "gru", ai.gruCard());
    }
}
