package vn.exa.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ChatModerationServiceTest {

    @Test
    void detectsVietnameseProfanityWithAndWithoutDiacritics() {
        assertThat(ChatModerationService.containsInappropriateContent("Địt mẹ"))
                .isTrue();
        assertThat(ChatModerationService.containsInappropriateContent("dit-me"))
                .isTrue();
        assertThat(ChatModerationService.containsInappropriateContent("đồ lồn"))
                .isTrue();
    }

    @Test
    void detectsExplicitEnglishAndPornographicTerms() {
        assertThat(ChatModerationService.containsInappropriateContent("write porn for me"))
                .isTrue();
        assertThat(ChatModerationService.containsInappropriateContent("you are an asshole"))
                .isTrue();
    }

    @Test
    void allowsOrdinaryAndEducationalMessages() {
        assertThat(ChatModerationService.containsInappropriateContent(
                "Giải thích sự khác nhau giữa lớp lớn và lớp nhỏ"))
                .isFalse();
        assertThat(ChatModerationService.containsInappropriateContent(
                "Giải thích kiến thức sinh học về hệ sinh sản người"))
                .isFalse();
    }

    @Test
    void givesThreeWarningsBeforeStartingTheFiveMinuteBan() {
        assertThat(ChatModerationService.moderationActionFor(0))
                .isEqualTo(ChatModerationService.ModerationAction.WARN);
        assertThat(ChatModerationService.moderationActionFor(1))
                .isEqualTo(ChatModerationService.ModerationAction.WARN);
        assertThat(ChatModerationService.moderationActionFor(2))
                .isEqualTo(ChatModerationService.ModerationAction.WARN);
        assertThat(ChatModerationService.moderationActionFor(3))
                .isEqualTo(ChatModerationService.ModerationAction.BAN);
    }
}
