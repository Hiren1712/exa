package vn.exa.ai;

import org.junit.jupiter.api.Test;

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
    void blankDeepSeekModelUsesDocumentedDefault() {
        assertThat(ChatbotService.resolveDeepSeekModel(null)).isEqualTo("deepseek-chat");
        assertThat(ChatbotService.resolveDeepSeekModel(" ")).isEqualTo("deepseek-chat");
        assertThat(ChatbotService.resolveDeepSeekModel(" deepseek-reasoner "))
                .isEqualTo("deepseek-reasoner");
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
