package vn.exa.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatbotServiceTest {

    @Test
    void providerOrderTrimsNamesAndRemovesDuplicatesWhilePreservingPriority() {
        assertThat(ChatbotService.parseProviderOrder(" gemini, openrouter,groq,gemini "))
                .containsExactly("gemini", "openrouter", "groq");
    }

    @Test
    void providerOrderRejectsUnknownProviders() {
        assertThatThrownBy(() -> ChatbotService.parseProviderOrder("gemini,unknown"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unsupported ExaBot provider: unknown");
    }
}
