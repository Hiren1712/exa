package vn.exa.ai;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatbotServiceTest {

    @Test
    void providerOrderTrimsNamesAndRemovesDuplicatesWhilePreservingPriority() {
        assertThat(ChatbotService.parseProviderOrder(" gemini, openrouter,groq,gemini "))
                .containsExactly("gemini", "openrouter", "groq");
    }

    @Test
    void blankProviderOrderUsesTheDefaultOrder() {
        assertThat(ChatbotService.parseProviderOrder(" "))
                .containsExactly("gemini", "openrouter", "openai", "groq", "deepseek");
    }

    @Test
    void preferredChatProviderIsTriedFirstThenFallsBackToConfiguredOrder() {
        assertThat(ChatbotService.prioritizeProviderOrder(
                List.of("gemini", "openrouter", "groq"), ChatbotService.ChatProvider.GROQ))
                .containsExactly("groq", "gemini", "openrouter");
        assertThat(ChatbotService.prioritizeProviderOrder(
                List.of("gemini", "groq"), null))
                .containsExactly("gemini", "groq");
        assertThat(ChatbotService.prioritizeProviderOrder(
                List.of("gemini"), ChatbotService.ChatProvider.GROQ))
                .containsExactly("gemini");
    }

    @Test
    void selectedChatProviderAddsItsResponseStyleToTheSharedSystemPrompt() {
        assertThat(ChatbotService.systemPrompt(true, ChatbotService.ChatProvider.GROQ))
                .contains("Ưu tiên phản hồi nhanh, ngắn gọn");
        assertThat(ChatbotService.systemPrompt(true, ChatbotService.ChatProvider.GEMINI))
                .contains("Ưu tiên giải thích chi tiết, trình bày từng bước");
    }

    @Test
    void blankDeepSeekModelUsesDocumentedDefault() {
        assertThat(ChatbotService.resolveDeepSeekModel(null)).isEqualTo("deepseek-chat");
        assertThat(ChatbotService.resolveDeepSeekModel(" ")).isEqualTo("deepseek-chat");
        assertThat(ChatbotService.resolveDeepSeekModel(" deepseek-reasoner "))
                .isEqualTo("deepseek-reasoner");
    }

    @Test
    void systemPromptExplainsEduLabAndSeparatesExaBotFromChemAI() {
        String prompt = ChatbotService.systemPrompt(true);

        assertThat(prompt)
                .contains("EduLab là hệ sinh thái website giáo dục STEM")
                .contains("ChemLab (Hóa học), PhysicsLab (Vật lý), MathLab (Toán học)")
                .contains("BioLab (Sinh học) và ITLab")
                .contains("ExaBot là trợ lý trong phân hệ EXA, không phải ChemAI")
                .contains("PhysicsAI, MathAI, BioAI và ITAI là định hướng tương lai")
                .contains("Không bịa tên bài học, mô-đun, thí nghiệm")
                .contains("Không chửi tục, công kích hoặc tạo nội dung khiêu dâm")
                .contains("Lê Hữu Nghĩa (12A1.1): đội trưởng")
                .contains("Lê Minh Đăng (12D3)")
                .contains("Đỗ Cao Minh (12A6)")
                .contains("Trần Thị Thanh Chúc (12A1)")
                .contains("Phan Văn Bình (11A2)")
                .contains("Nguyễn Văn Tình (11A3)")
                .contains("kiểm thử chất lượng (QA/QC)")
                .contains("thiết kế giao diện (UI)");
    }

    @Test
    void providerOrderRejectsUnknownProviders() {
        assertThatThrownBy(() -> ChatbotService.parseProviderOrder("gemini,unknown"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unsupported ExaBot provider: unknown");
    }

    @Test
    void geminiKeysUsePrimaryThenNumberedSlotsInNumericOrder() {
        assertThat(ChatbotService.orderedApiKeys("gemini", "primary-key", Map.of(
                "gemini2", "second-key",
                "gemini10", "tenth-key",
                "gemini1", "first-key",
                "deep1", "unrelated-key")))
                .extracting(ChatbotService.ApiKeySlot::slot, ChatbotService.ApiKeySlot::apiKey)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("primary", "primary-key"),
                        org.assertj.core.groups.Tuple.tuple("1", "first-key"),
                        org.assertj.core.groups.Tuple.tuple("2", "second-key"),
                        org.assertj.core.groups.Tuple.tuple("10", "tenth-key"));
    }

    @Test
    void deepseekKeysAcceptDeepAndDeepseekNumberedNames() {
        assertThat(ChatbotService.orderedApiKeys("deepseek", "", Map.of(
                "deep3", "third-key",
                "deepseek1", "first-key",
                "deep1", "preferred-first-key",
                "deep2", "second-key")))
                .extracting(ChatbotService.ApiKeySlot::slot, ChatbotService.ApiKeySlot::apiKey)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("1", "preferred-first-key"),
                        org.assertj.core.groups.Tuple.tuple("2", "second-key"),
                        org.assertj.core.groups.Tuple.tuple("3", "third-key"));
    }
}
