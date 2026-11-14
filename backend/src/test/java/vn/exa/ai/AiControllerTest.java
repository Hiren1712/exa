package vn.exa.ai;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import vn.exa.common.CurrentUser;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AiControllerTest {

    @Test
    void chatRequestAcceptsAlternatingConversationEndingWithUser() {
        AiController.ChatMessage userMessage = message("user", "Xin chào");
        AiController.ChatMessage assistantMessage = message("assistant", "Chào bạn");
        AiController.ChatMessage nextUserMessage = message("user", "Giải thích đạo hàm");
        AiController.ChatRequest request = new AiController.ChatRequest();
        request.setMessages(List.of(userMessage, assistantMessage, nextUserMessage));

        assertThat(request.isConversationValid()).isTrue();
    }

    @Test
    void chatRequestCanSelectEitherSupportedProvider() {
        AiController.ChatRequest request = new AiController.ChatRequest();
        request.setMessages(List.of(message("user", "Giải thích đạo hàm")));
        request.setProvider(ChatbotService.ChatProvider.GROQ);

        assertThat(request.getProvider()).isEqualTo(ChatbotService.ChatProvider.GROQ);
    }

    @Test
    void chatRequestRejectsRepeatedRolesAndConversationEndingWithAssistant() {
        AiController.ChatRequest repeatedRole = new AiController.ChatRequest();
        repeatedRole.setMessages(List.of(message("user", "Câu hỏi 1"), message("user", "Câu hỏi 2")));
        AiController.ChatRequest endingWithAssistant = new AiController.ChatRequest();
        endingWithAssistant.setMessages(List.of(message("user", "Câu hỏi"), message("assistant", "Trả lời")));

        assertThat(repeatedRole.isConversationValid()).isFalse();
        assertThat(endingWithAssistant.isConversationValid()).isFalse();
    }

    @Test
    void chatRequestRejectsNullMessagesWithoutThrowing() {
        AiController.ChatRequest request = new AiController.ChatRequest();
        request.setMessages(java.util.Arrays.asList(message("user", "Xin chào"), null));

        assertThat(request.isConversationValid()).isFalse();
    }

    @Test
    void blockedChatReturnsRetryAfterWithoutCallingAi() {
        AiService aiService = mock(AiService.class);
        ChatModerationService moderationService = mock(ChatModerationService.class);
        when(moderationService.admit(42L, "nội dung tục tĩu"))
                .thenReturn(new ChatModerationService.Admission(
                        false, 0, "CHAT_VIOLATION_BANNED", 300, "Chat bị tạm khóa 5 phút."));
        AiController controller = new AiController(aiService, moderationService);
        AiController.ChatRequest request = new AiController.ChatRequest();
        request.setMessages(List.of(message("user", "nội dung tục tĩu")));

        var response = controller.chat(request, new CurrentUser(42L, "student@example.com", "STUDENT"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("300");
        assertThat(response.getBody().getCode()).isEqualTo("CHAT_VIOLATION_BANNED");
        verifyNoInteractions(aiService);
    }

    @Test
    void warningDoesNotCallAiAndReturnsTheWarningCount() {
        AiService aiService = mock(AiService.class);
        ChatModerationService moderationService = mock(ChatModerationService.class);
        when(moderationService.admit(42L, "nội dung tục tĩu"))
                .thenReturn(new ChatModerationService.Admission(
                        false, 2, "CHAT_WARNING", 7, "Cảnh báo 2/3"));
        AiController controller = new AiController(aiService, moderationService);
        AiController.ChatRequest request = new AiController.ChatRequest();
        request.setMessages(List.of(message("user", "nội dung tục tĩu")));

        var response = controller.chat(request, new CurrentUser(42L, "student@example.com", "STUDENT"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getData().moderationWarning()).isTrue();
        assertThat(response.getBody().getData().warningCount()).isEqualTo(2);
        verifyNoInteractions(aiService);
    }

    private static AiController.ChatMessage message(String role, String content) {
        AiController.ChatMessage message = new AiController.ChatMessage();
        message.setRole(role);
        message.setContent(content);
        return message;
    }
}
