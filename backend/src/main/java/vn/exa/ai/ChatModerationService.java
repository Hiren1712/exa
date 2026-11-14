package vn.exa.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChatModerationService {

    public static final int COOLDOWN_SECONDS = 7;
    public static final int BAN_SECONDS = 5 * 60;
    public static final int MAX_WARNINGS = 3;

    private static final Set<String> ACCENTED_INAPPROPRIATE_TERMS = Set.of(
            "địt", "đụ", "đm", "đmm", "đcm", "đéo", "lồn", "cặc", "buồi", "đĩ");
    private static final Set<String> UNACCENTED_INAPPROPRIATE_TERMS = Set.of(
            "dit", "ditme", "ditmay", "dm", "dmm", "dcm", "deo");
    private static final Set<String> ENGLISH_INAPPROPRIATE_TERMS = Set.of(
            "fuck", "fucking", "shit", "bitch", "asshole", "dick", "pussy", "cunt",
            "porn", "pornographic", "hentai", "sextape", "sextapes");

    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public Admission admit(Long userId, String message) {
        jdbcTemplate.update("INSERT IGNORE INTO exabot_chat_limits (user_id) VALUES (?)", userId);

        ChatState state = jdbcTemplate.queryForObject("""
                SELECT
                    COALESCE(CEIL(GREATEST(0, TIMESTAMPDIFF(
                        MICROSECOND, CURRENT_TIMESTAMP(6), banned_until)) / 1000000), 0) AS ban_seconds,
                    COALESCE(CEIL(GREATEST(0, TIMESTAMPDIFF(
                        MICROSECOND, CURRENT_TIMESTAMP(6), cooldown_until)) / 1000000), 0) AS cooldown_seconds,
                    warning_count
                FROM exabot_chat_limits
                WHERE user_id = ?
                FOR UPDATE
                """, (resultSet, rowNumber) -> new ChatState(
                resultSet.getLong("ban_seconds"),
                resultSet.getLong("cooldown_seconds"),
                resultSet.getInt("warning_count")), userId);

        if (state.banSeconds() > 0) {
            return new Admission(false, state.warningCount(), "CHAT_TEMPORARILY_BANNED", state.banSeconds(),
                    "ExaBot đã tạm khóa chat do tin nhắn vi phạm quy tắc ứng xử. "
                            + "Bạn có thể chat lại sau " + state.banSeconds() + " giây.");
        }
        if (containsInappropriateContent(message)) {
            if (moderationActionFor(state.warningCount()) == ModerationAction.WARN) {
                int warningCount = state.warningCount() + 1;
                jdbcTemplate.update("""
                        UPDATE exabot_chat_limits
                        SET warning_count = ?,
                            cooldown_until = DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 7 SECOND)
                        WHERE user_id = ?
                        """, warningCount, userId);
                String warningMessage = warningCount == MAX_WARNINGS
                        ? "Cảnh báo " + warningCount + "/" + MAX_WARNINGS
                                + ": Đây là lần nhắc cuối. Nếu tiếp tục vi phạm, ExaBot sẽ khóa chat 5 phút."
                        : "Cảnh báo " + warningCount + "/" + MAX_WARNINGS
                                + ": Vui lòng dùng ngôn từ phù hợp. Tiếp tục vi phạm sẽ bị khóa chat 5 phút.";
                return new Admission(false, warningCount, "CHAT_WARNING", COOLDOWN_SECONDS, warningMessage);
            }
            jdbcTemplate.update("""
                    UPDATE exabot_chat_limits
                    SET banned_until = DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 5 MINUTE),
                        cooldown_until = NULL,
                        warning_count = 0
                    WHERE user_id = ?
                    """, userId);
            return new Admission(false, 0, "CHAT_VIOLATION_BANNED", BAN_SECONDS,
                    "Bạn đã tiếp tục vi phạm sau 3 lần nhắc nhở. ExaBot tạm khóa chat trong 5 phút.");
        }
        if (state.cooldownSeconds() > 0) {
            return new Admission(false, state.warningCount(), "CHAT_COOLDOWN", state.cooldownSeconds(),
                    "Vui lòng đợi " + state.cooldownSeconds()
                            + " giây giữa các lượt hỏi để tránh gửi tin nhắn liên tục.");
        }

        jdbcTemplate.update("""
                UPDATE exabot_chat_limits
                SET cooldown_until = DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 7 SECOND)
                WHERE user_id = ?
                """, userId);
        return new Admission(true, state.warningCount(), null, COOLDOWN_SECONDS, null);
    }

    static ModerationAction moderationActionFor(int warningCount) {
        return warningCount >= MAX_WARNINGS ? ModerationAction.BAN : ModerationAction.WARN;
    }

    static boolean containsInappropriateContent(String message) {
        String text = message.toLowerCase(Locale.ROOT);
        Set<String> originalTokens = tokens(Normalizer.normalize(text, Normalizer.Form.NFC));
        if (originalTokens.stream().anyMatch(ACCENTED_INAPPROPRIATE_TERMS::contains)
                || originalTokens.stream().anyMatch(ENGLISH_INAPPROPRIATE_TERMS::contains)) {
            return true;
        }

        String withoutDiacritics = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return tokens(withoutDiacritics).stream()
                .anyMatch(UNACCENTED_INAPPROPRIATE_TERMS::contains);
    }

    private static Set<String> tokens(String text) {
        return Arrays.stream(text.split("[^\\p{L}\\p{N}]+"))
                .filter(token -> !token.isBlank())
                .collect(java.util.stream.Collectors.toSet());
    }

    enum ModerationAction {
        WARN,
        BAN
    }

    private record ChatState(long banSeconds, long cooldownSeconds, int warningCount) {}

    public record Admission(
            boolean allowed, int warningCount, String code, long retryAfterSeconds, String message) {}
}
