package vn.exa.ai;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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

    private static AiController.ChatMessage message(String role, String content) {
        AiController.ChatMessage message = new AiController.ChatMessage();
        message.setRole(role);
        message.setContent(content);
        return message;
    }
}
